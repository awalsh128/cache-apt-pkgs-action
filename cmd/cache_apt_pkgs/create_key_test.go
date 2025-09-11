package main

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

func TestGetCreateKeyCmd(t *testing.T) {
	cmd := GetCreateKeyCmd()

	if cmd == nil {
		t.Fatal("GetCreateKeyCmd returned nil")
	}

	if cmd.Name != "createkey" {
		t.Errorf("Expected command name 'createkey', got '%s'", cmd.Name)
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

	// Check that required flags are present
	expectedFlags := []string{
		"os-arch",
		"plaintext-path",
		"ciphertext-path",
		"version",
		"global-version",
		"cache-dir",
	}
	for _, flagName := range expectedFlags {
		if cmd.Flags.Lookup(flagName) == nil {
			t.Errorf("Expected flag '%s' to be defined", flagName)
		}
	}

	// Check default value for os-arch
	osArchFlag := cmd.Flags.Lookup("os-arch")
	if osArchFlag != nil && osArchFlag.DefValue != runtime.GOARCH {
		t.Errorf(
			"Expected os-arch default to be '%s', got '%s'",
			runtime.GOARCH,
			osArchFlag.DefValue,
		)
	}
}

func TestCreateKey_Success(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir, err := os.MkdirTemp("", "cache_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create a mock command with required flags
	cmd := GetCreateKeyCmd()
	cmd.Flags.Set("version", "1.0")
	cmd.Flags.Set("global-version", "1.0")
	cmd.Flags.Set("os-arch", "amd64")
	cmd.Flags.Set("cache-dir", tmpDir)

	// Create test packages
	packages := pkgs.NewPackages(pkgs.Package{Name: "test-package"})

	// Run the createKey function
	err = createKey(cmd, packages)
	if err != nil {
		t.Errorf("createKey failed: %v", err)
	}

	// Verify that cache key files were created
	keyFile := filepath.Join(tmpDir, "cache_key.txt")
	md5File := filepath.Join(tmpDir, "cache_key.md5")

	if _, err := os.Stat(keyFile); os.IsNotExist(err) {
		t.Error("cache_key.txt was not created")
	}

	if _, err := os.Stat(md5File); os.IsNotExist(err) {
		t.Error("cache_key.md5 was not created")
	}
}

func TestCreateKey_InvalidCacheDir(t *testing.T) {
	cmd := GetCreateKeyCmd()
	cmd.Flags.Set("version", "1.0")
	cmd.Flags.Set("global-version", "1.0")
	cmd.Flags.Set("os-arch", "amd64")
	cmd.Flags.Set("cache-dir", "/nonexistent/directory")

	packages := pkgs.NewPackages(pkgs.Package{Name: "test-package"})

	err := createKey(cmd, packages)
	if err == nil {
		t.Error("Expected error when using invalid cache directory")
	}
}

func TestCreateKey_EmptyPackages(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "cache_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	cmd := GetCreateKeyCmd()
	cmd.Flags.Set("version", "1.0")
	cmd.Flags.Set("global-version", "1.0")
	cmd.Flags.Set("os-arch", "amd64")
	cmd.Flags.Set("cache-dir", tmpDir)

	// Empty packages
	packages := pkgs.NewPackages()

	err = createKey(cmd, packages)
	if err != nil {
		t.Errorf("createKey should handle empty packages, got error: %v", err)
	}
}
