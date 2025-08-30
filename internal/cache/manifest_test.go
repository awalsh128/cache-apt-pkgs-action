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
	manifestVersion    = "1.0.0"
	manifestGlobalVer  = "v2"
	manifestArch      = "amd64"
	manifestFile      = "manifest.json"
	samplePkgName     = "xdot"
	samplePkgVersion  = "1.3-1"
	samplePkgBinPath  = "/usr/bin/xdot"
	samplePkgDocPath  = "/usr/share/doc/xdot"
)

var (
	fixedTime = time.Date(2025, 8, 28, 10, 0, 0, 0, time.UTC)
	emptyPkgs = pkgs.NewPackages()
	sampleKey = Key{
		Packages:      emptyPkgs,
		Version:       manifestVersion,
		GlobalVersion: manifestGlobalVer,
		OsArch:       manifestArch,
	}
	sampleManifest = &Manifest{
		CacheKey:          sampleKey,
		LastModified:      fixedTime,
		InstalledPackages: []ManifestPackage{},
	}
	samplePackage = pkgs.Package{
		Name:    samplePkgName,
		Version: samplePkgVersion,
	}
	sampleFilePaths = []string{samplePkgBinPath, samplePkgDocPath}
)

func createManifestFile(t *testing.T, dir string, m *Manifest) string {
	t.Helper()
	path := filepath.Join(dir, manifestFile)
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
		CacheKey:          sampleKey,
		LastModified:      fixedTime,
		InstalledPackages: []ManifestPackage{},
	}

	// Act
	actual := &Manifest{
		CacheKey:          sampleKey,
		LastModified:      fixedTime,
		InstalledPackages: []ManifestPackage{},
	}

	// Assert
	assertManifestEquals(t, expected, actual)
}

func TestNewManifest_WithSinglePackage_CreatesValidStructure(t *testing.T) {
	// Arrange
	expected := &Manifest{
		CacheKey:     sampleKey,
		LastModified: fixedTime,
		InstalledPackages: []ManifestPackage{
			{
				Package:   samplePackage,
				Filepaths: sampleFilePaths,
			},
		},
	}

	// Act
	actual := &Manifest{
		CacheKey:     sampleKey,
		LastModified: fixedTime,
		InstalledPackages: []ManifestPackage{
			{
				Package:   samplePackage,
				Filepaths: sampleFilePaths,
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
	if !reflect.DeepEqual(actual.LastModified, expected.LastModified) {
		t.Errorf("LastModified = %v, want %v", actual.LastModified, expected.LastModified)
	}
	if !reflect.DeepEqual(actual.InstalledPackages, expected.InstalledPackages) {
		t.Errorf("InstalledPackages = %v, want %v", actual.InstalledPackages, expected.InstalledPackages)
	}
}

func TestRead_WithValidManifest_ReturnsMatchingStruct(t *testing.T) {
	// Arrange
	dir := t.TempDir()
	expected := &Manifest{
		CacheKey:     sampleKey,
		LastModified: fixedTime,
		InstalledPackages: []ManifestPackage{
			{
				Package:   samplePackage,
				Filepaths: sampleFilePaths,
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
	path := filepath.Join(dir, manifestFile)
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
	testTime := time.Now()
	testPkgs := pkgs.NewPackagesFromStrings("pkg1=1.0", "pkg2=2.0")

	tests := []struct {
		name        string
		key         Key
		expected    *Manifest
		expectError bool
	}{
		{
			name: "empty manifest with minimum fields",
			key: Key{
				Packages:      pkgs.NewPackages(),
				Version:       "1.0.0",
				GlobalVersion: "v2",
				OsArch:       "amd64",
			},
			expected: &Manifest{
				CacheKey:     Key{Packages: pkgs.NewPackages(), Version: "1.0.0", GlobalVersion: "v2", OsArch: "amd64"},
				LastModified: testTime,
				InstalledPackages: []ManifestPackage{},
			},
			expectError: false,
		},
		{
			name: "manifest with package list",
			key: Key{
				Packages:      testPkgs,
				Version:       "1.0.0",
				GlobalVersion: "v2",
				OsArch:       "amd64",
			},
			expectError: false,
			expected: &Manifest{
				CacheKey: Key{
					Packages:      testPkgs,
					Version:       "1.0.0",
					GlobalVersion: "v2",
					OsArch:       "amd64",
				},
				LastModified:      testTime,
				InstalledPackages: []ManifestPackage{},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			manifest := &Manifest{
				CacheKey:          tt.key,
				LastModified:      testTime,
				InstalledPackages: []ManifestPackage{},
			}
			
			// Act
			actual := manifest
			
			// Assert
			assertManifestEquals(t, tt.expected, actual)
		})
	}
}

func TestRead_WithVariousContents_HandlesAllCases(t *testing.T) {
	// Arrange
	tmpDir := t.TempDir()
	testTime := time.Now()
	testPkgs := pkgs.NewPackagesFromStrings("xdot=1.3-1")

	tests := []struct {
		name        string
		input       *Manifest
		expectError bool
	}{
		{
			name: "empty manifest",
			input: &Manifest{
				CacheKey: Key{
					Packages:      testPkgs,
					Version:       "1.0.0",
					GlobalVersion: "v2",
					OsArch:       "amd64",
				},
				LastModified:      testTime,
				InstalledPackages: []ManifestPackage{},
			},
			expectError: false,
		},
		{
			name: "manifest with packages",
			input: &Manifest{
				CacheKey: Key{
					Packages:      testPkgs,
					Version:       "1.0.0",
					GlobalVersion: "v2",
					OsArch:       "amd64",
				},
				LastModified: testTime,
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
