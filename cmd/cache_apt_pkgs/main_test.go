package main

import (
	"testing"
)

func TestMain_CommandStructure(t *testing.T) {
	// Test that all commands are properly initialized
	commands := CreateCmds(
		GetCreateKeyCmd(),
		GetInstallCmd(),
		GetRestoreCmd(),
		GetSetupCmd(),
		GetCleanupCmd(),
		GetValidateCmd(),
	)

	if commands == nil {
		t.Fatal("CreateCmds returned nil")
	}

	// Check that all expected commands exist
	expectedCommands := []string{"createkey", "install", "restore", "setup", "cleanup", "validate"}
	for _, cmdName := range expectedCommands {
		if _, ok := commands.Get(cmdName); !ok {
			t.Errorf("Expected command '%s' to be available", cmdName)
		}
	}
}

func TestMain_AllCommandsHaveRequiredFields(t *testing.T) {
	commands := CreateCmds(
		GetCreateKeyCmd(),
		GetInstallCmd(),
		GetRestoreCmd(),
		GetSetupCmd(),
		GetCleanupCmd(),
		GetValidateCmd(),
	)

	for cmdName, cmd := range *commands {
		t.Run(cmdName, func(t *testing.T) {
			if cmd.Name == "" {
				t.Error("Command name should not be empty")
			}
			if cmd.Description == "" {
				t.Error("Command description should not be empty")
			}
			if cmd.Flags == nil {
				t.Error("Command flags should not be nil")
			}
			if cmd.Run == nil {
				t.Error("Command Run function should not be nil")
			}
		})
	}
}
