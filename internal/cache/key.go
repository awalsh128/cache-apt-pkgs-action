package cache

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"

	"awalsh128.com/cache-apt-pkgs-action/internal/logging"
	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

// Key represents a unique identifier for a package cache entry.
// It combines package information with version and architecture details to create
// a deterministic cache key. Keys are immutable after creation and generate
// consistent hashes by maintaining sorted package order and using a fixed string format.
type Key struct {
	packages      pkgs.Packages // Sorted list of packages to be cached
	version       string        // User-specified cache version
	globalVersion string        // Action's global version for cache invalidation
	osArch        string        // Target architecture (e.g., amd64, arm64)
}

// File permissions for written key files
const (
	keyFileMode = 0644
)

// NewKey creates a new cache key with the specified parameters.
// The packages are already sorted when constructed to provide a deterministic order and hash.
func NewKey(packages pkgs.Packages, version, globalVersion, osArch string) (Key, error) {
	missingFields := []string{}
	if globalVersion == "" {
		missingFields = append(missingFields, "globalVersion")
	}
	if osArch == "" {
		missingFields = append(missingFields, "osArch")
	}
	if len(missingFields) > 0 {
		return Key{}, fmt.Errorf("missing required fields: %v", missingFields)
	}
	return Key{
		packages:      packages,
		version:       version,
		globalVersion: globalVersion,
		osArch:        osArch,
	}, nil
}

// Packages returns the packages associated with this cache key.
// The returned value is guaranteed to be sorted.
func (k Key) Packages() pkgs.Packages {
	return k.packages
}

// Version returns the user-specified cache version.
func (k Key) Version() string {
	return k.version
}

// GlobalVersion returns the action's global version used for cache invalidation.
func (k Key) GlobalVersion() string {
	return k.globalVersion
}

// OsArch returns the target architecture.
func (k Key) OsArch() string {
	return k.osArch
}

// String returns a human-readable string representation of the cache key.
// The output format is deterministic since Packages are guaranteed to be sorted.
// This method implements the fmt.Stringer interface.
func (k Key) String() string {
	return fmt.Sprintf("Packages: '%s', Version: '%s', GlobalVersion: '%s', OsArch: '%s'",
		k.packages.String(), k.version, k.globalVersion, k.osArch)
}

// Hash generates a deterministic SHA256 hash of the key's contents.
// This hash is used as the actual cache key for storage and lookup.
//
// Note: SHA256 is used here for better collision resistance and security.
// The hash is based on the string representation to ensure consistency.
func (k Key) Hash() []byte {
	hash := sha256.Sum256([]byte(k.String()))
	return hash[:]
}

// WriteError represents an error that occurred during key writing operations.
// It provides context about which file and operation failed, along with the underlying error.
// This type implements both the error interface and error unwrapping.
type WriteError struct {
	Path      string // File path that failed
	Operation string // Operation being performed (plaintext/hash)
	Err       error  // Underlying error that occurred
}

// Error implements the error interface.
func (e *WriteError) Error() string {
	return fmt.Sprintf("failed to write %s to %s: %v", e.Operation, e.Path, e.Err)
}

// Unwrap returns the underlying error for error unwrapping.
func (e *WriteError) Unwrap() error {
	return e.Err
}

// Write stores both the plaintext and hashed versions of the cache key to files.
// This allows for both human inspection and fast cache lookups.
//
// The method writes:
//   - Human-readable key representation to plaintextPath
//   - Binary hash of the key to hashPath
//
// Both operations must succeed for the method to return nil.
// If either operation fails, no partial state is left behind.
func (k Key) Write(plaintextPath, hashPath string) error {
	// Write plaintext representation
	if err := k.writePlaintext(plaintextPath); err != nil {
		return &WriteError{
			Path:      plaintextPath,
			Operation: "plaintext key",
			Err:       err,
		}
	}

	// Write hash representation
	if err := k.writeHash(hashPath); err != nil {
		// Attempt cleanup of plaintext file on hash write failure
		if removeErr := os.Remove(plaintextPath); removeErr != nil {
			logging.Info("Failed to cleanup plaintext file %s after hash write failure: %v",
				plaintextPath, removeErr)
		}

		return &WriteError{
			Path:      hashPath,
			Operation: "hash key",
			Err:       err,
		}
	}

	return nil
}

// writePlaintext writes the human-readable key representation to the specified path.
func (k Key) writePlaintext(path string) error {
	keyText := k.String()
	logging.Info("Writing cache key plaintext to %s", path)

	if err := os.WriteFile(path, []byte(keyText), keyFileMode); err != nil {
		return fmt.Errorf("write plaintext: %w", err)
	}

	logging.Info("Completed writing cache key plaintext")
	return nil
}

// writeHash writes the binary hash to the specified path.
func (k Key) writeHash(path string) error {
	keyHash := k.Hash()
	logging.Info("Writing cache key hash to %s", path)

	if err := os.WriteFile(path, keyHash, keyFileMode); err != nil {
		return fmt.Errorf("write hash: %w", err)
	}

	logging.Info("Completed writing cache key hash")
	return nil
}

// ReadKey reads and validates a cache key from the filesystem.
// It returns the plaintext content and hash, or an error if validation fails.
//
// This function verifies that:
//   - Both files exist and are readable
//   - The hash file contains exactly 16 bytes (MD5 hash size)
//   - The computed hash of plaintext matches the stored hash
func ReadKey(plaintextPath, hashPath string) (plaintext string, hash []byte, err error) {
	if checkFileExists(plaintextPath) != nil {
		return "", nil, fmt.Errorf("plaintext file does not exist: %s", plaintextPath)
	}
	if checkFileExists(hashPath) != nil {
		return "", nil, fmt.Errorf("hash file does not exist: %s", hashPath)
	}

	// Read plaintext
	plaintextBytes, err := os.ReadFile(plaintextPath)
	if err != nil {
		return "", nil, fmt.Errorf("read plaintext from %s: %w", plaintextPath, err)
	}
	plaintext = string(plaintextBytes)

	// Read stored hash
	storedHash, err := os.ReadFile(hashPath)
	if err != nil {
		return "", nil, fmt.Errorf("read hash from %s: %w", hashPath, err)
	}

	// Validate hash length
	if len(storedHash) != sha256.Size {
		return "", nil, fmt.Errorf("invalid hash length in %s: got %d bytes, want %d",
			hashPath, len(storedHash), sha256.Size)
	}

	// Verify hash matches plaintext
	computedHash := sha256.Sum256(plaintextBytes)
	if string(computedHash[:]) != string(storedHash) {
		return "", nil, fmt.Errorf("hash mismatch: stored hash does not match plaintext content")
	}

	return plaintext, storedHash, nil
}

// KeyExists checks if both plaintext and hash key files exist at the specified paths.
// It returns true only if both files exist and are accessible.
func KeyExists(plaintextPath, hashPath string) bool {
	if err := checkFileExists(plaintextPath); err != nil {
		return false
	}

	if err := checkFileExists(hashPath); err != nil {
		return false
	}

	return true
}

// checkFileExists verifies that a file exists and is accessible.
func checkFileExists(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}

	if info.IsDir() {
		return fmt.Errorf("path is a directory: %s", path)
	}

	return nil
}

// keyJSON is a helper struct for JSON serialization of Key.
// It uses exported fields and concrete types that JSON can handle.
type keyJSON struct {
	Packages      []pkgs.Package `json:"packages"`
	Version       string         `json:"version"`
	GlobalVersion string         `json:"globalVersion"`
	OsArch        string         `json:"osArch"`
}

// MarshalJSON implements custom JSON marshaling for Key.
func (k Key) MarshalJSON() ([]byte, error) {
	// Convert packages to slice
	pkgSlice := make([]pkgs.Package, k.packages.Len())
	for i := 0; i < k.packages.Len(); i++ {
		pkgSlice[i] = *k.packages.Get(i)
	}

	keyData := keyJSON{
		Packages:      pkgSlice,
		Version:       k.version,
		GlobalVersion: k.globalVersion,
		OsArch:        k.osArch,
	}

	return json.Marshal(keyData)
}

// UnmarshalJSON implements custom JSON unmarshaling for Key.
func (k *Key) UnmarshalJSON(data []byte) error {
	var keyData keyJSON
	if err := json.Unmarshal(data, &keyData); err != nil {
		return err
	}

	// Convert slice back to Packages interface
	packages := pkgs.NewPackages(keyData.Packages...)

	k.packages = packages
	k.version = keyData.Version
	k.globalVersion = keyData.GlobalVersion
	k.osArch = keyData.OsArch

	return nil
}
