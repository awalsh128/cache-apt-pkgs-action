package cmdflags

import (
	"flag"
	"testing"

	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

const (
	flagSetName      = "test_flag_set_name"
	flagName         = "test-flag"
	flagValue        = "test_flag_value"
	flagDefaultValue = "test_default_flag_value"
	flagDescription  = "This is a test flag"
	cmdName          = "test-command-name"
	argExample       = "test-package"
	requiredFlagName = "required-flag"
)

func TestCmd_StringFlag(t *testing.T) {
	cmd := &Cmd{
		Name:  cmdName,
		Flags: flag.NewFlagSet(flagSetName, flag.ContinueOnError),
	}
	cmd.Flags.String(flagName, flagDefaultValue, flagDescription)

	// Parse some args to set the flag value
	cmd.Flags.Set(flagName, flagValue)

	result := cmd.StringFlag(flagName)
	if result != flagValue {
		t.Errorf("Expected %q, got %q", flagValue, result)
	}
}

func TestNewCmd(t *testing.T) {
	runCalled := false
	runFunc := func(cmd *Cmd, pkgArgs pkgs.Packages) error {
		runCalled = true
		return nil
	}

	cmd := NewCmd(cmdName, "test description", []string{argExample}, runFunc)

	if cmd == nil {
		t.Fatal("NewCmd returned nil")
	}
	if cmd.Name != cmdName {
		t.Errorf("Expected name %q, got %q", cmdName, cmd.Name)
	}
	if cmd.Description == "" {
		t.Error("Expected non-empty description")
	}
	if cmd.Flags == nil {
		t.Error("Expected flags to be initialized")
	}
	if cmd.Run == nil {
		t.Error("Expected Run function to be set")
	}
	if len(cmd.Examples) != 1 {
		t.Errorf("Expected 1 example, got %d", len(cmd.Examples))
	}

	// Test that Run function works
	err := cmd.Run(cmd, pkgs.NewPackages())
	if err != nil {
		t.Errorf("Unexpected error calling Run: %v", err)
	}
	if !runCalled {
		t.Error("Expected run function to be called")
	}
}

func TestCmd_ParseFlagsLogic(t *testing.T) {
	t.Run("missing required flags", func(t *testing.T) {
		cmd := NewCmd(cmdName, "test description", []string{argExample}, func(cmd *Cmd, pkgArgs pkgs.Packages) error {
			return nil
		})
		cmd.Flags.String(requiredFlagName, "", "required flag description")

		// Test that the flag was added
		requiredFlag := cmd.Flags.Lookup(requiredFlagName)
		if requiredFlag == nil {
			t.Error("Expected required-flag to be registered")
		}
		if requiredFlag.DefValue != "" {
			t.Error("Expected required-flag to have empty default value")
		}
	})

	t.Run("flag registration", func(t *testing.T) {
		cmd := NewCmd(cmdName, "test description", []string{}, func(cmd *Cmd, pkgArgs pkgs.Packages) error {
			return nil
		})

		// Check that global flags are inherited
		if cmd.Flags.Lookup("verbose") == nil {
			t.Error("Expected verbose flag to be inherited from global flags")
		}
		if cmd.Flags.Lookup("help") == nil {
			t.Error("Expected help flag to be inherited from global flags")
		}
	})
}
