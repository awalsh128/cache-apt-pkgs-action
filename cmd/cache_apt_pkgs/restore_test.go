package main

import (
	"os"
	"strings"
	"testing"

	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

func TestGetRestoreCmd(t *testing.T) {
	cmd := GetRestoreCmd()

	if cmd == nil {
		t.Fatal("GetRestoreCmd returned nil")
	}

	if cmd.Name != "restore" {
		t.Errorf("Expected command name 'restore', got '%s'", cmd.Name)
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
	expectedFlags := []string{"cache-dir", "restore-root", "execute-scripts"}
	for _, flagName := range expectedFlags {
		if cmd.Flags.Lookup(flagName) == nil {
			t.Errorf("Expected flag '%s' to be defined", flagName)
		}
	}

	// Check default values
	restoreRootFlag := cmd.Flags.Lookup("restore-root")
	if restoreRootFlag != nil && restoreRootFlag.DefValue != "/" {
		t.Errorf("Expected restore-root default to be '/', got '%s'", restoreRootFlag.DefValue)
	}

	executeScriptsFlag := cmd.Flags.Lookup("execute-scripts")
	if executeScriptsFlag != nil && executeScriptsFlag.DefValue != "false" {
		t.Errorf(
			"Expected execute-scripts default to be 'false', got '%s'",
			executeScriptsFlag.DefValue,
		)
	}
}

func TestRestore_NotImplemented(t *testing.T) {
	cmd := GetRestoreCmd()

	// Create a temporary directory for testing
	tmpDir, err := os.MkdirTemp("", "restore_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Set up command flags
	cmd.Flags.Set("cache-dir", tmpDir)

	packages := pkgs.NewPackages(pkgs.Package{Name: "test-package"})

	// The restore function should now fail because there's no manifest file
	err = restore(cmd, packages)
	if err == nil {
		t.Error("Expected error when manifest file doesn't exist")
	}

	// Check that the error is about reading the manifest
	if !strings.Contains(err.Error(), "error reading manifest") {
		t.Errorf("Expected error about reading manifest, got '%s'", err.Error())
	}
}

func TestRestore_EmptyPackages(t *testing.T) {
	cmd := GetRestoreCmd()

	// Create a temporary directory for testing
	tmpDir, err := os.MkdirTemp("", "restore_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Set up command flags
	cmd.Flags.Set("cache-dir", tmpDir)

	packages := pkgs.NewPackages()

	// The restore function should fail because there's no manifest file
	err = restore(cmd, packages)
	if err == nil {
		t.Error("Expected error when manifest file doesn't exist")
	}

	// Check that the error is about reading the manifest
	if !strings.Contains(err.Error(), "error reading manifest") {
		t.Errorf("Expected error about reading manifest, got '%s'", err.Error())
	}
}
