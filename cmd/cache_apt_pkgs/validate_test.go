package main

import (
	"strings"
	"testing"

	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

func TestGetValidateCmd(t *testing.T) {
	cmd := GetValidateCmd()

	if cmd == nil {
		t.Fatal("GetValidateCmd returned nil")
	}

	if cmd.Name != "validate" {
		t.Errorf("Expected command name 'validate', got '%s'", cmd.Name)
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
}

// Note: Testing the actual validate function requires APT which may not be available in test environment
// This test focuses on the command structure and basic functionality
func TestValidate_EmptyPackages(t *testing.T) {
	cmd := GetValidateCmd()
	packages := pkgs.NewPackages()

	// With no packages, validation should succeed (no packages to validate)
	if err := validate(cmd, packages); err != nil {
		if strings.Contains(err.Error(), "no supported package manager") {
			t.Skip("APT is not available in the test environment")
		}
		t.Errorf("validate with empty packages should succeed, got error: %v", err)
	}
}

// Mock test that doesn't require APT to be installed
func TestValidate_Structure(t *testing.T) {
	cmd := GetValidateCmd()

	// Verify the command is properly structured
	if cmd.Run == nil {
		t.Error("Expected Run function to be set")
	}

	// Test that we can create packages to validate (structure test)
	packages := pkgs.NewPackages(pkgs.Package{Name: "test-package"})
	if packages.Len() != 1 {
		t.Error("Failed to create test packages")
	}

	// Note: We can't test the actual validation without APT installed
	// The validate function will likely fail in test environment, which is expected
}
