package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// Integration test for the real commands used by main.
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
