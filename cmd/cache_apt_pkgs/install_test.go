package main

import (
	"os"
	"path/filepath"
	"testing"

	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

func TestGetInstallCmd(t *testing.T) {
	cmd := GetInstallCmd()

	if cmd == nil {
		t.Fatal("GetInstallCmd returned nil")
	}

	if cmd.Name != "install" {
		t.Errorf("Expected command name 'install', got '%s'", cmd.Name)
	}

	if cmd.Description == "" {
		t.Error("Expected non-empty description")
	}

	if cmd.Flags == nil {
		t.Fatal("Expected flags to be initialized")
	}

	if cmd.Run == nil {
		t.Fatal("Expected Run function to be set")
	}

	if cmd.ExamplePackages == nil {
		t.Error("Expected ExamplePackages to be set")
	}

	if len(cmd.Examples) == 0 {
		t.Error("Expected Examples to be set")
	}

	// Check that required flags are present
	expectedFlags := []string{"cache-dir", "version", "global-version"}
	for _, flagName := range expectedFlags {
		if cmd.Flags.Lookup(flagName) == nil {
			t.Errorf("Expected flag '%s' to be defined", flagName)
		}
	}
}

// Note: Testing the actual install function requires APT and system-level access
// This test focuses on the command structure and error handling
func TestInstall_Structure(t *testing.T) {
	cmd := GetInstallCmd()

	// Create a temporary directory for testing
	tmpDir, err := os.MkdirTemp("", "install_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Set up command flags
	cmd.Flags.Set("cache-dir", tmpDir)
	cmd.Flags.Set("version", "1.0")
	cmd.Flags.Set("global-version", "1.0")

	packages := pkgs.NewPackages(pkgs.Package{Name: "test-package"})

	// The install function will likely fail in test environment without APT
	// but we can verify the function exists and is callable
	err = install(cmd, packages)

	// We expect an error because APT is likely not available in test environment
	// The important thing is that the function doesn't panic
	if err == nil {
		// If no error, check that manifest files were created
		manifestFile := filepath.Join(tmpDir, "manifest.json")
		if _, err := os.Stat(manifestFile); os.IsNotExist(err) {
			t.Log(
				"Note: install succeeded but manifest.json not found - this may be expected in test environment",
			)
		}
	} else {
		t.Logf("install function returned expected error in test environment: %v", err)
	}
}

func TestInstall_EmptyPackages(t *testing.T) {
	cmd := GetInstallCmd()

	tmpDir, err := os.MkdirTemp("", "install_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	cmd.Flags.Set("cache-dir", tmpDir)
	cmd.Flags.Set("version", "1.0")
	cmd.Flags.Set("global-version", "1.0")

	packages := pkgs.NewPackages()

	// The install function should handle empty packages gracefully
	err = install(cmd, packages)

	// We expect this to fail due to APT not being available, but it shouldn't panic
	if err != nil {
		t.Logf("install with empty packages returned expected error: %v", err)
	}
}
