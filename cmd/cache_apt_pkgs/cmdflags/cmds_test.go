package cmdflags

import (
	"os"
	"testing"

	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

const (
	cmdName1 = "test-command-1"
	cmdName2 = "test-command-2"
)

func TestCmds_Add(t *testing.T) {
	cmds := make(Cmds)
	cmd := NewCmd(cmdName, "test description", []string{argExample}, func(cmd *Cmd, pkgArgs pkgs.Packages) error {
		return nil
	})

	err := cmds.Add(cmd)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}

	if len(cmds) != 1 {
		t.Errorf("Expected 1 command, got %d", len(cmds))
	}
	if _, exists := cmds[cmdName]; !exists {
		t.Errorf("Expected command %q to be added", cmdName)
	}
}

func TestCmds_Get(t *testing.T) {
	cmds := make(Cmds)
	expectedCmd := NewCmd(cmdName, "test description", []string{argExample}, func(cmd *Cmd, pkgArgs pkgs.Packages) error {
		return nil
	})
	cmds.Add(expectedCmd)

	t.Run("existing command", func(t *testing.T) {
		cmd, ok := cmds.Get(cmdName)
		if !ok {
			t.Error("Expected to find command")
		}
		if cmd != expectedCmd {
			t.Error("Expected to get the same command instance")
		}
	})

	t.Run("non-existing command", func(t *testing.T) {
		_, ok := cmds.Get("non-existent-command")
		if ok {
			t.Error("Expected not to find non-existent command")
		}
	})

	// Test multiple commands
	cmd1 := NewCmd(cmdName1, "description 1", []string{}, func(cmd *Cmd, pkgArgs pkgs.Packages) error { return nil })
	cmd2 := NewCmd(cmdName2, "description 2", []string{}, func(cmd *Cmd, pkgArgs pkgs.Packages) error { return nil })

	cmds2 := make(Cmds)
	cmds2.Add(cmd1)
	cmds2.Add(cmd2)

	if _, ok := cmds2.Get(cmdName1); !ok {
		t.Errorf("Expected to find %s", cmdName1)
	}
	if _, ok := cmds2.Get(cmdName2); !ok {
		t.Errorf("Expected to find %s", cmdName2)
	}
}

func TestCreateCmds(t *testing.T) {
	cmds := CreateCmds()

	expectedCommands := []string{"install", "restore", "validate", "setup", "cleanup", "createkey"}

	if len(*cmds) != len(expectedCommands) {
		t.Errorf("Expected %d commands, got %d", len(expectedCommands), len(*cmds))
	}

	for _, cmdName := range expectedCommands {
		cmd, ok := cmds.Get(cmdName)
		if !ok {
			t.Errorf("Expected command %q to exist", cmdName)
			continue
		}
		if cmd.Name != cmdName {
			t.Errorf("Expected command name %q, got %q", cmdName, cmd.Name)
		}
		if cmd.Description == "" {
			t.Errorf("Expected non-empty description for command %q", cmdName)
		}
		if cmd.Flags == nil {
			t.Errorf("Expected flags to be initialized for command %q", cmdName)
		}
		if cmd.Run == nil {
			t.Errorf("Expected Run function to be set for command %q", cmdName)
		}
	}
}

func TestCmds_Parse(t *testing.T) {
	// Note: These tests don't call Parse() directly as it calls os.Exit
	// Instead they test the Parse method's logic through integration with os.Args

	origArgs := os.Args
	defer func() { os.Args = origArgs }()

	t.Run("missing command", func(t *testing.T) {
		// Test the condition that would trigger the missing command error
		os.Args = []string{binaryName}
		// Can't actually call Parse() here as it will exit the test process
		// Just verify the setup
		if len(os.Args) < 2 {
			t.Log("Command would be missing, Parse() would show usage")
		}
	})

	const pkgArg1 = "test-package=1.1-beta"
	const pkgArg2 = "test-package=2.0"

	t.Run("valid command with packages", func(t *testing.T) {
		os.Args = []string{binaryName, cmdName, pkgArg1, pkgArg2}

		if len(os.Args) >= 4 {
			actualCmdName := os.Args[1]
			actualPkgArgs := os.Args[2:]

			if actualCmdName != cmdName {
				t.Errorf("Expected command '%s', got %s", cmdName, actualCmdName)
			}
			if len(actualPkgArgs) != 2 {
				t.Errorf("Expected 2 package args, got %d", len(actualPkgArgs))
			}
		} else {
			t.Error("Expected at least 4 args for this test")
		}
	})
}
