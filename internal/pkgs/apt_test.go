package pkgs

import (
	"testing"
)

func TestNewApt(t *testing.T) {
	apt, err := NewApt()
	if err != nil {
		t.Fatalf("NewApt() error = %v", err)
	}
	if apt == nil {
		t.Error("NewApt() returned nil without error")
	}
}

func TestApt_Install(t *testing.T) {
	// Note: These tests require a real system and apt to be available
	// They should be run in a controlled environment like a Docker container
	tests := []struct {
		name        string
		pkgs        []Package
		expectedErr bool
	}{
		{
			name:        "Empty package list",
			pkgs:        []Package{},
			expectedErr: false,
		},
		{
			name:        "Invalid package",
			pkgs:        []Package{{Name: "nonexistent-package-12345"}},
			expectedErr: true,
		},
	}

	apt, err := NewApt()
	if err != nil {
		t.Fatalf("Failed to create Apt instance: %v", err)
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			packages := NewPackages(tt.pkgs...)
			_, err := apt.Install(packages)
			if (err != nil) != tt.expectedErr {
				t.Errorf("Apt.Install() error = %v, expectedErr %v", err, tt.expectedErr)
			}
		})
	}
}

func TestApt_ListInstalledFiles_NonExistentPackage_ReturnsError(t *testing.T) {
	// Note: These tests require a real system and apt to be available
	apt, err := NewApt()
	if err != nil {
		t.Fatalf("Failed to create Apt instance: %v", err)
	}
	_, err = apt.ListInstalledFiles(&Package{Name: "nonexistent-package-12345"})
	if err == nil {
		t.Errorf("Apt.ListInstalledFiles() expected error, but got nil")
		return
	}
}
