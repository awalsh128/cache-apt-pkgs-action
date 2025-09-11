package cache

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

const (
	package1 = "xdot=1.3-1"
	package2 = "rolldice=1.16-1build3"

	version1 = "test1"
	version2 = "test2"

	globalVersion1 = "v1"
	globalVersion2 = "v2"

	archAmd64 = "amd64"
	archX86   = "x86"
)

//==============================================================================
// Helper Functions
//==============================================================================

func createKey(t *testing.T, packages []string, version, globalVersion, osArch string) Key {
	t.Helper()
	key, err := NewKey(
		pkgs.NewPackagesFromStrings(packages...),
		version,
		globalVersion,
		osArch,
	)
	if err != nil {
		t.Fatalf("Failed to create key: %v", err)
	}
	return key
}

func assertStringEquals(t *testing.T, key Key, expected string) {
	t.Helper()
	actual := key.String()
	if actual != expected {
		t.Errorf("String() = %q, expected %q", actual, expected)
	}
}

func assertHashesEqual(t *testing.T, key1, key2 Key) {
	t.Helper()
	hash1 := key1.Hash()
	hash2 := key2.Hash()
	if !bytes.Equal(hash1, hash2) {
		t.Errorf("Hashes should be equal: key1=%x, key2=%x", hash1, hash2)
	}
}

func assertHashesDifferent(t *testing.T, key1, key2 Key) {
	t.Helper()
	hash1 := key1.Hash()
	hash2 := key2.Hash()
	if bytes.Equal(hash1, hash2) {
		t.Errorf("Hashes should be different but were equal: %x", hash1)
	}
}

func assertFileContentEquals(t *testing.T, filePath string, expected []byte) {
	t.Helper()
	actual, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("Failed to read file %s: %v", filePath, err)
	}
	if !bytes.Equal(actual, expected) {
		t.Errorf("File content mismatch in %s: actual %q, expected %q", filePath, actual, expected)
	}
}

//==============================================================================
// String Tests
//==============================================================================

func TestKeyString_WithEmptyKey_ReturnsError(t *testing.T) {
	// Arrange & Act
	_, err := NewKey(
		pkgs.NewPackagesFromStrings(),
		"",
		"",
		"",
	)

	// Assert
	if err == nil {
		t.Error("Expected error but got nil")
	}
}

func TestKeyString_WithSinglePackage_ReturnsFormattedString(t *testing.T) {
	// Arrange
	key := createKey(t, []string{package1}, version1, globalVersion2, archAmd64)
	expected := fmt.Sprintf(
		"Packages: '%s', Version: '%s', GlobalVersion: '%s', OsArch: '%s'",
		package1,
		version1,
		globalVersion2,
		archAmd64,
	)

	// Act & Assert
	assertStringEquals(t, key, expected)
}

func TestKeyString_WithMultiplePackages_ReturnsCommaSeparatedString(t *testing.T) {
	// Arrange
	key := createKey(
		t,
		[]string{package1, package2}, // xdot=1.3-1, rolldice=1.16-1build3
		version1,
		globalVersion2,
		archAmd64,
	)
	// Packages are sorted, so "rolldice" comes before "xdot"
	expected := fmt.Sprintf(
		"Packages: '%s %s', Version: '%s', GlobalVersion: '%s', OsArch: '%s'",
		package2,
		package1,
		version1,
		globalVersion2,
		archAmd64,
	)

	// Act & Assert
	assertStringEquals(t, key, expected)
}

//==============================================================================
// Hash Tests
//==============================================================================

func TestKeyHash_WithIdenticalKeys_ReturnsSameHash(t *testing.T) {
	// Arrange
	key1 := createKey(t, []string{package1}, version1, globalVersion2, archAmd64)
	key2 := createKey(t, []string{package1}, version1, globalVersion2, archAmd64)

	// Act & Assert
	assertHashesEqual(t, key1, key2)
}

func TestKeyHash_WithDifferences_ReturnsDifferentHash(t *testing.T) {
	tests := []struct {
		name string
		key1 Key
		key2 Key
	}{
		{
			name: "Different packages",
			key1: createKey(t, []string{package1}, version1, globalVersion1, archAmd64),
			key2: createKey(t, []string{package2}, version1, globalVersion1, archAmd64),
		},
		{
			name: "Different versions",
			key1: createKey(t, []string{package1}, version1, globalVersion1, archAmd64),
			key2: createKey(t, []string{package2}, version2, globalVersion1, archAmd64),
		},
		{
			name: "Different global versions",
			key1: createKey(t, []string{package1}, version1, globalVersion1, archAmd64),
			key2: createKey(t, []string{package2}, version1, globalVersion2, archAmd64),
		},
		{
			name: "Different architectures",
			key1: createKey(t, []string{package1}, version1, globalVersion1, archAmd64),
			key2: createKey(t, []string{package1}, version1, globalVersion2, archX86),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertHashesDifferent(t, tt.key1, tt.key2)
		})
	}
}

//==============================================================================
// Write Tests
//==============================================================================

func TestKeyWrite_WithValidPaths_WritesPlaintextAndHash(t *testing.T) {
	// Arrange
	key := createKey(
		t,
		[]string{package1, package2},
		version1,
		globalVersion2,
		archAmd64,
	)

	plaintextPath := filepath.Join(t.TempDir(), "key.txt")
	ciphertextPath := filepath.Join(t.TempDir(), "key.md5")

	// Act
	err := key.Write(plaintextPath, ciphertextPath)
	// Assert
	if err != nil {
		t.Fatalf("Write() failed: %v", err)
	}

	// Verify plaintext file
	expectedPlaintext := []byte(key.String())
	assertFileContentEquals(t, plaintextPath, expectedPlaintext)

	// Verify hash file
	expectedHash := key.Hash()
	assertFileContentEquals(t, ciphertextPath, expectedHash)
}

func TestKeyWrite_WithInvalidPlaintextPath_ReturnsError(t *testing.T) {
	// Arrange
	key := createKey(t, []string{package1}, version1, globalVersion2, archAmd64)
	invalidPath := "/invalid/path/key.txt"
	validPath := filepath.Join(t.TempDir(), "key.md5")

	// Act
	err := key.Write(invalidPath, validPath)

	// Assert
	if err == nil {
		t.Error("Write() should have failed with invalid plaintext path")
	}
}

func TestKeyWrite_WithInvalidCiphertextPath_ReturnsError(t *testing.T) {
	// Arrange
	key := createKey(t, []string{package1}, version1, globalVersion2, archAmd64)
	validPath := filepath.Join(t.TempDir(), "key.txt")
	invalidPath := "/invalid/path/key.md5"

	// Act
	err := key.Write(validPath, invalidPath)

	// Assert
	if err == nil {
		t.Error("Write() should have failed with invalid ciphertext path")
	}
}

//==============================================================================
// Integration Tests
//==============================================================================

func TestKeyWriteAndRead_PlaintextRoundTrip_PreservesContent(t *testing.T) {
	// Arrange
	key := createKey(
		t,
		[]string{package1, package2},
		version1,
		globalVersion2,
		archAmd64,
	)
	tempDir := t.TempDir()
	plaintextPath := filepath.Join(tempDir, "key.txt")
	ciphertextPath := filepath.Join(tempDir, "key.md5")

	// Act
	err := key.Write(plaintextPath, ciphertextPath)
	if err != nil {
		t.Fatalf("Write() failed: %v", err)
	}

	plaintextBytes, err := os.ReadFile(plaintextPath)
	if err != nil {
		t.Fatalf("ReadFile() failed: %v", err)
	}

	// Assert
	actualPlaintext := string(plaintextBytes)
	expectedPlaintext := key.String()
	if actualPlaintext != expectedPlaintext {
		t.Errorf(
			"Plaintext round trip failed: actual %q, expected %q",
			actualPlaintext,
			expectedPlaintext,
		)
	}
}

func TestKeyWriteAndRead_CiphertextRoundTrip_PreservesHash(t *testing.T) {
	// Arrange
	key := createKey(
		t,
		[]string{package1, package2},
		version1,
		globalVersion2,
		archAmd64,
	)
	tempDir := t.TempDir()
	plaintextPath := filepath.Join(tempDir, "key.txt")
	ciphertextPath := filepath.Join(tempDir, "key.md5")

	// Act
	err := key.Write(plaintextPath, ciphertextPath)
	if err != nil {
		t.Fatalf("Write() failed: %v", err)
	}

	ciphertextBytes, err := os.ReadFile(ciphertextPath)
	if err != nil {
		t.Fatalf("ReadFile() failed: %v", err)
	}

	// Assert
	expectedHash := key.Hash()
	if !bytes.Equal(ciphertextBytes, expectedHash) {
		t.Errorf(
			"Ciphertext round trip failed: actual %x, expected %x",
			ciphertextBytes,
			expectedHash,
		)
	}
}
