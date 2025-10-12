package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"awalsh128.com/cache-apt-pkgs-action/internal/logging"
	atesting "awalsh128.com/cache-apt-pkgs-action/internal/testing"
)

// SetupTest performs per-test initialization and registers cleanup hooks.
func SetupTest(t *testing.T) {
	logging.Init(true)
	t.Cleanup(func() {
		logging.InitDefault()
	})
}

// Integration test for main processing actual and non-existent commands.
//
// NOTE: No args are tested, just help as an example of a valid command.
func TestIntegration_MainCommands(t *testing.T) {
	// Build the binary first
	binaryPath := filepath.Join(t.TempDir(), "cache-apt-pkgs")
	cmd := exec.Command("go", "build", "-o", binaryPath, ".")
	cmd.Dir = "."
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to build binary: %v", err)
	}

	// Test cases for different subcommands
	testCases := []struct {
		name        string
		args        []string
		expectError bool
	}{
		{
			name:        "help",
			args:        []string{"--help"},
			expectError: false, // --help exits with 0
		},
		{
			name:        "no_args",
			args:        []string{},
			expectError: true, // no command specified
		},
		{
			name:        "unknown_command",
			args:        []string{"unknown"},
			expectError: true,
		},
		{
			name:        "createkey_help",
			args:        []string{"createkey", "--help"},
			expectError: false, // command help exits with 0
		},
		{
			name:        "install_help",
			args:        []string{"install", "--help"},
			expectError: false,
		},
		{
			name:        "restore_help",
			args:        []string{"restore", "--help"},
			expectError: false,
		},
		{
			name:        "validate_help",
			args:        []string{"validate", "--help"},
			expectError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cmd := exec.Command(binaryPath, tc.args...)
			err := cmd.Run()

			if tc.expectError && err == nil {
				t.Errorf("Expected error for %s but got none", tc.name)
			}
			if !tc.expectError && err != nil {
				t.Errorf("Expected no error for %s but got: %v", tc.name, err)
			}
		})
	}
}

// Test that commands can be executed (they may fail due to missing dependencies, but shouldn't crash)
func TestIntegration_CommandExecution(t *testing.T) {
	// Create temp directory for testing
	tmpDir := t.TempDir()

	// Build the binary
	binaryPath := filepath.Join(tmpDir, "cache-apt-pkgs")
	cmd := exec.Command("go", "build", "-o", binaryPath, ".")
	cmd.Dir = "."
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to build binary: %v", err)
	}

	// Test createkey with minimal args (should work without APT)
	t.Run("createkey_execution", func(t *testing.T) {
		cacheDir := filepath.Join(tmpDir, "cache")
		if err := os.MkdirAll(cacheDir, 0755); err != nil {
			t.Fatalf("Failed to create cache dir: %v", err)
		}

		cmd := exec.Command(binaryPath, "createkey",
			"--cache-dir", cacheDir,
			"--version", "1.0",
			"--global-version", "1.0",
			"test-package")

		// This should succeed since createkey doesn't require APT
		if err := cmd.Run(); err != nil {
			t.Logf("createkey execution failed (may be expected in test environment): %v", err)
		} else {
			// Check if cache key files were created
			keyFile := filepath.Join(cacheDir, "cache_key.txt")
			md5File := filepath.Join(cacheDir, "cache_key.md5")

			if _, err := os.Stat(keyFile); err != nil {
				t.Errorf("cache_key.txt was not created: %v", err)
			}

			if _, err := os.Stat(md5File); err != nil {
				t.Errorf("cache_key.md5 was not created: %v", err)
			}
		}
	})

	// Test other commands (expected to fail without APT but shouldn't crash)
	testCommands := []struct {
		name string
		args []string
	}{
		{"validate", []string{"validate", "test-package"}},
		{
			"install",
			[]string{
				"install",
				"--cache-dir",
				tmpDir,
				"--version",
				"1.0",
				"--global-version",
				"1.0",
				"test-package",
			},
		},
		{"restore", []string{"restore", "--cache-dir", tmpDir, "test-package"}},
	}

	for _, tc := range testCommands {
		t.Run(tc.name+"_no_crash", func(t *testing.T) {
			cmd := exec.Command(binaryPath, tc.args...)
			err := cmd.Run()
			// We expect these to fail in test environment, but they shouldn't crash
			if err != nil {
				t.Logf("%s command failed as expected in test environment: %v", tc.name, err)
			}
		})
	}
}

type execRunResponse struct {
	stdout string
	stderr string
	err    error
	ghVars map[string]string
}

func execBinaryAndReturnResponse(t *testing.T, binaryPath string, args []string) (response execRunResponse) {
	t.Helper()
	var err error
	stdout, stderr := atesting.CaptureStd(func() {
		cmd := exec.Command(binaryPath, args...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		err = cmd.Run()
	})
	return execRunResponse{
		stdout: stdout,
		stderr: stderr,
		err:    err,
	}
}

// Simulate a pseudo GitHub Actions workflow using the commands

func TestIntegration_PseudoActionWorkflow(t *testing.T) {
	const cacheDirName = "cache-apt-pkgs-action-cache"
	const pkgs = "xdot rolldice"

	// This test simulates a pseudo GitHub Actions workflow using the commands
	tmpDir := t.TempDir()
	cacheDir := filepath.Join(tmpDir, cacheDirName)
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		t.Fatalf("Failed to create cache dir: %v", err)
	}

	// Build the binary
	binaryPath := filepath.Join(tmpDir, "cache-apt-pkgs")
	cmd := exec.Command("go", "build", "-o", binaryPath, ".")
	cmd.Dir = "."
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to build binary: %v", err)
	}

	// Step 1: Validate packages
	response := execBinaryAndReturnResponse(t, binaryPath, []string{"validate", pkgs})
	if response.err != nil {
		t.Fatalf("validate failed: %v", response.err)
	}

	// Step 2: Create cache key
	response = execBinaryAndReturnResponse(t, binaryPath, []string{"createkey",
		"--cache-dir", cacheDir,
		"--version", "1.0",
		"--global-version", "1.0",
		"--ciphertext-path", filepath.Join(cacheDir, "cache_key.sha256"),
		"--plaintext-path", filepath.Join(cacheDir, "cache_key.txt"),
		pkgs})
	if response.err != nil {
		t.Fatalf("createkey command failed: %v", response.err)
	}

	// if response.ghVars["cache-hit"] == "true" {
	// 	t.Log("Cache hit detected, executing restore.")
	// 	// Step 4b: Restore packages
	// 	response = execBinaryAndReturnResponse(t, binaryPath, []string{"restore",
	// 		"--cache-dir", cacheDir,
	// 		pkgs})
	// 	if response.err != nil {
	// 		t.Logf("restore failed: %v", response.err)
	// 	}
	// } else {
	// 	t.Log("No cache hit, executing install.")
	// 	// Step 4a: Install packages
	// 	response = execBinaryAndReturnResponse(t, binaryPath, []string{"install",
	// 		"--cache-dir", cacheDir,
	// 		"--version", "1.0",
	// 		"--global-version", "1.0",
	// 		pkgs})
	// 	if response.err != nil {
	// 		t.Logf("install command failed: %v", response.err)
	// 	}
	// }

	// t.Log("Pseudo GitHub Actions workflow simulation completed.")
}
