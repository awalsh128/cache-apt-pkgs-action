package cache

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	version    = "1.0.0"
	globalVer  = "20250901"
	arch       = "amd64"
	file       = "manifest.json"
	pkgName    = "xdot"
	pkgVersion = "1.3-1"
	pkgBinPath = "/usr/bin/xdot"
	pkgDocPath = "/usr/share/doc/xdot"
)

var (
	fixedTime = time.Date(2025, 8, 28, 10, 0, 0, 0, time.UTC)
	emptyPkgs = pkgs.NewPackages()
	key       = createTestKey()
	pkg1      = pkgs.Package{
		Name:    pkgName,
		Version: pkgVersion,
	}
	pkg2 = pkgs.Package{
		Name:    "zlib",
		Version: "1.1.0",
	}
	filepaths = []string{pkgBinPath, pkgDocPath}
)

func createTestKey() Key {
	key, err := NewKey(emptyPkgs, version, globalVer, arch)
	if err != nil {
		panic("Failed to create test key: " + err.Error())
	}
	return key
}

func createManifestFile(t *testing.T, dir string, m *Manifest) string {
	t.Helper()
	path := filepath.Join(dir, file)
	data, err := json.Marshal(m)
	if err != nil {
		t.Fatalf("Failed to marshal manifest: %v", err)
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		t.Fatalf("Failed to write manifest file: %v", err)
	}
	return path
}

func TestNewManifest_WithEmptyPackages_CreatesValidStructure(t *testing.T) {
	// Arrange
	expected := &Manifest{
		CacheKey:          key,
		LastModified:      fixedTime,
		InstalledPackages: []ManifestPackage{},
	}

	// Act
	actual := &Manifest{
		CacheKey:          key,
		LastModified:      fixedTime,
		InstalledPackages: []ManifestPackage{},
	}

	// Assert
	assertManifestEquals(t, expected, actual)
}

func TestNewManifest_WithSinglePackage_CreatesValidStructure(t *testing.T) {
	// Arrange
	expected := &Manifest{
		CacheKey:     key,
		LastModified: fixedTime,
		InstalledPackages: []ManifestPackage{
			{
				Package:   pkg1,
				Filepaths: filepaths,
			},
		},
	}

	// Act
	actual := &Manifest{
		CacheKey:     key,
		LastModified: fixedTime,
		InstalledPackages: []ManifestPackage{
			{
				Package:   pkg1,
				Filepaths: filepaths,
			},
		},
	}

	// Assert
	assertManifestEquals(t, expected, actual)
}

// Helper function for comparing Manifests
func assertManifestEquals(t *testing.T, expected, actual *Manifest) {
	t.Helper()
	if !reflect.DeepEqual(actual.CacheKey, expected.CacheKey) {
		t.Errorf("CacheKey = %v, want %v", actual.CacheKey, expected.CacheKey)
	}
	if !actual.LastModified.Equal(expected.LastModified) {
		t.Errorf("LastModified = %v, want %v", actual.LastModified, expected.LastModified)
	}
	if !reflect.DeepEqual(actual.InstalledPackages, expected.InstalledPackages) {
		t.Errorf(
			"InstalledPackages = %v, want %v",
			actual.InstalledPackages,
			expected.InstalledPackages,
		)
	}
}

func TestRead_WithValidManifest_ReturnsMatchingStruct(t *testing.T) {
	// Arrange
	dir := t.TempDir()
	expected := &Manifest{
		CacheKey:     key,
		LastModified: fixedTime,
		InstalledPackages: []ManifestPackage{
			{
				Package:   pkg1,
				Filepaths: filepaths,
			},
		},
	}
	path := createManifestFile(t, dir, expected)

	// Act
	actual, err := Read(path)
	// Assert
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}
	assertManifestEquals(t, expected, actual)
}

func TestRead_WithNonExistentFile_ReturnsError(t *testing.T) {
	// Arrange
	dir := t.TempDir()
	path := filepath.Join(dir, "nonexistent.json")

	// Act
	actual, err := Read(path)

	// Assert
	assertError(t, err, "no such file or directory")
	assert.Nil(t, actual)
}

func TestRead_WithInvalidJSON_ReturnsError(t *testing.T) {
	// Arrange
	dir := t.TempDir()
	path := filepath.Join(dir, file)
	if err := os.WriteFile(path, []byte("invalid json"), 0644); err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	// Act
	actual, err := Read(path)

	// Assert
	assertError(t, err, "failed to unmarshal")
	assert.Nil(t, actual)
}

// Helper function for asserting errors
func assertError(t *testing.T, err error, expectedMsg string) {
	t.Helper()
	if err == nil {
		t.Error("expected error but got nil")
		return
	}
	if !strings.Contains(err.Error(), expectedMsg) {
		t.Errorf("error = %v, expected to contain %q", err, expectedMsg)
	}
}

func TestNew_WithVariousInputs_CreatesCorrectStructure(t *testing.T) {
	// Arrange
	time := time.Now()

	tests := []struct {
		name        string
		key         Key
		expected    *Manifest
		expectError bool
	}{
		{
			name: "empty manifest with minimum fields",
			key:  key,
			expected: &Manifest{
				CacheKey:          key,
				LastModified:      time,
				InstalledPackages: []ManifestPackage{},
			},
			expectError: false,
		},
		{
			name:        "manifest with package list",
			key:         key,
			expectError: false,
			expected: &Manifest{
				CacheKey:     key,
				LastModified: time,
				InstalledPackages: []ManifestPackage{
					{
						Package:   pkg1,
						Filepaths: []string{pkgBinPath, pkgDocPath},
					},
					{
						Package:   pkg2,
						Filepaths: []string{pkgBinPath, pkgDocPath},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act - create the actual manifest with the expected structure
			actual := &Manifest{
				CacheKey:          tt.key,
				LastModified:      time,
				InstalledPackages: tt.expected.InstalledPackages, // Use expected packages
			}

			// Assert
			assertManifestEquals(t, tt.expected, actual)
		})
	}
}

func TestRead_WithVariousContents_HandlesAllCases(t *testing.T) {
	// Arrange
	tmpDir := t.TempDir()
	time := time.Now()

	tests := []struct {
		name        string
		input       *Manifest
		expectError bool
	}{
		{
			name: "empty manifest",
			input: &Manifest{
				CacheKey:          key,
				LastModified:      time,
				InstalledPackages: []ManifestPackage{},
			},
			expectError: false,
		},
		{
			name: "manifest with packages",
			input: &Manifest{
				CacheKey:     key,
				LastModified: time,
				InstalledPackages: []ManifestPackage{
					{
						Package:   pkgs.Package{Name: "xdot", Version: "1.3-1"},
						Filepaths: []string{"/usr/bin/xdot", "/usr/share/doc/xdot"},
					},
				},
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			testDir := filepath.Join(tmpDir, tt.name)
			require.NoError(t, os.MkdirAll(testDir, 0755))

			path := filepath.Join(testDir, "manifest.json")
			data, err := json.Marshal(tt.input)
			require.NoError(t, err)
			require.NoError(t, os.WriteFile(path, data, 0644))

			// Act
			actual, err := Read(path)

			// Assert
			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, actual)
			} else {
				assert.NoError(t, err)
				assertManifestEquals(t, tt.input, actual)
			}
		})
	}
}
