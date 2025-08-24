package cache

import (
	"os"
	"path/filepath"
	"testing"

	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

func TestNewManifest(t *testing.T) {
	// Create a temporary directory for test files
	tmpDir, err := os.MkdirTemp("", "manifest-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	tests := []struct {
		name        string
		key         Key
		wantErr     bool
		setupFiles  []string // Files to create before test
		verifyFiles []string // Files to verify after creation
	}{
		{
			name: "Valid manifest creation",
			key: Key{
				Packages:      pkgs.NewPackages(),
				Version:       "test",
				GlobalVersion: "v2",
				OsArch:        "amd64",
			},
			wantErr: false,
			verifyFiles: []string{
				"manifest.json",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup test files
			testDir := filepath.Join(tmpDir, tt.name)
			err := os.MkdirAll(testDir, 0755)
			if err != nil {
				t.Fatalf("Failed to create test directory: %v", err)
			}

			for _, file := range tt.setupFiles {
				path := filepath.Join(testDir, file)
				if err := os.WriteFile(path, []byte("test content"), 0644); err != nil {
					t.Fatalf("Failed to create test file %s: %v", file, err)
				}
			}

			// Create manifest
			manifest, err := NewManifest(tt.key)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewManifest() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if err == nil {
				// Verify manifest is created correctly
				if manifest == nil {
					t.Error("NewManifest() returned nil manifest without error")
					return
				}

				// Verify expected files exist
				for _, file := range tt.verifyFiles {
					path := filepath.Join(testDir, file)
					if _, err := os.Stat(path); os.IsNotExist(err) {
						t.Errorf("Expected file %s does not exist", file)
					}
				}
			}
		})
	}
}

func TestManifest_Save(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "manifest-save-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	tests := []struct {
		name     string
		manifest *Manifest
		wantErr  bool
	}{
		{
			name: "Save empty manifest",
			manifest: &Manifest{
				Key: Key{
					Packages:      pkgs.NewPackages(),
					Version:       "test",
					GlobalVersion: "v2",
					OsArch:        "amd64",
				},
				Packages: []ManifestPackage{},
			},
			wantErr: false,
		},
		{
			name: "Save manifest with packages",
			manifest: &Manifest{
				Key: Key{
					Packages:      pkgs.NewPackagesFromSlice([]string{"xdot=1.3-1"}),
					Version:       "test",
					GlobalVersion: "v2",
					OsArch:        "amd64",
				},
				Packages: []ManifestPackage{
					{
						Name:    "xdot",
						Version: "1.3-1",
						Files:   []string{"/usr/bin/xdot", "/usr/share/doc/xdot"},
					},
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			testDir := filepath.Join(tmpDir, tt.name)
			if err := os.MkdirAll(testDir, 0755); err != nil {
				t.Fatalf("Failed to create test directory: %v", err)
			}

			if err := tt.manifest.Save(testDir); (err != nil) != tt.wantErr {
				t.Errorf("Manifest.Save() error = %v, wantErr %v", err, tt.wantErr)
			}

			// Verify manifest file was created
			manifestPath := filepath.Join(testDir, "manifest.json")
			if _, err := os.Stat(manifestPath); os.IsNotExist(err) {
				t.Error("Manifest file was not created")
			}
		})
	}
}
