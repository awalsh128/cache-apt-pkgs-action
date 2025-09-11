package main

import (
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
	packages := pkgs.NewPackages(pkgs.Package{Name: "test-package"})

	// The restore function is not implemented and should return an error
	err := restore(cmd, packages)
	if err == nil {
		t.Error("Expected error from unimplemented restore function")
	}

	expectedMsg := "restorePackages not implemented"
	if err.Error() != expectedMsg {
		t.Errorf("Expected error message '%s', got '%s'", expectedMsg, err.Error())
	}
}

func TestRestore_EmptyPackages(t *testing.T) {
	cmd := GetRestoreCmd()
	packages := pkgs.NewPackages()

	// Even with empty packages, restore should return not implemented error
	err := restore(cmd, packages)
	if err == nil {
		t.Error("Expected error from unimplemented restore function")
	}
}
