// Package cache provides caching functionality for APT packages and their metadata.
package cache

import (
	"crypto/md5"
	"fmt"
	"os"

	"awalsh128.com/cache-apt-pkgs-action/internal/logging"
	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

// Key represents a unique identifier for a package cache entry.
// It combines package information with version and architecture details to create
// a deterministic cache key.
type Key struct {
	// Packages is a sorted list of packages to be cached
	// This is guaranteed by the pkgs.Packages interface
	Packages pkgs.Packages
	// Version is the user-specified cache version
	Version string
	// GlobalVersion is the action's global version, used for cache invalidation
	GlobalVersion string
	// OsArch is the target architecture (e.g., amd64, arm64)
	OsArch string
}

// PlainText returns a human-readable string representation of the cache key.
// The output format is deterministic since Packages are guaranteed to be sorted.
func (k *Key) PlainText() string {
	return fmt.Sprintf("Packages: '%s', Version: '%s', GlobalVersion: '%s', OsArch: '%s'",
		k.Packages.String(), k.Version, k.GlobalVersion, k.OsArch)
}

// Hash generates a deterministic MD5 hash of the key's contents.
// This hash is used as the actual cache key for storage and lookup.
func (k *Key) Hash() []byte {
	hash := md5.Sum([]byte(k.PlainText()))
	return hash[:]
}

// Write stores both the plaintext and hashed versions of the cache key to files.
// This allows for both human inspection and fast cache lookups.
func (k *Key) Write(plaintextPath string, ciphertextPath string) error {
	keyText := k.PlainText()
	logging.Info("Writing cache key plaintext to %s.", plaintextPath)
	if err := os.WriteFile(plaintextPath, []byte(keyText), 0644); err != nil {
		return fmt.Errorf("write failed to %s: %w", plaintextPath, err)
	}
	logging.Info("Completed writing cache key plaintext.")

	keyHash := k.Hash()
	logging.Info("Writing cache key hash to %s.", ciphertextPath)
	if err := os.WriteFile(ciphertextPath, keyHash[:], 0644); err != nil {
		return fmt.Errorf("write failed to %s: %w", ciphertextPath, err)
	}
	logging.Info("Completed writing cache key hash.")

	return nil
}
