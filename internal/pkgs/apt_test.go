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
		name    string
		pkgs    []string
		wantErr bool
	}{
		{
			name:    "Empty package list",
			pkgs:    []string{},
			wantErr: false,
		},
		{
			name:    "Invalid package",
			pkgs:    []string{"nonexistent-package-12345"},
			wantErr: true,
		},
	}

	apt, err := NewApt()
	if err != nil {
		t.Fatalf("Failed to create Apt instance: %v", err)
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			packages := NewPackages()
			for _, pkg := range tt.pkgs {
				packages.Add(pkg)
			}

			_, err := apt.Install(packages)
			if (err != nil) != tt.wantErr {
				t.Errorf("Apt.Install() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestApt_ListInstalledFiles(t *testing.T) {
	// Note: These tests require a real system and apt to be available
	apt, err := NewApt()
	if err != nil {
		t.Fatalf("Failed to create Apt instance: %v", err)
	}

	tests := []struct {
		name    string
		pkg     string
		want    []string
		wantErr bool
	}{
		{
			name:    "Invalid package",
			pkg:     "nonexistent-package-12345",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := apt.ListInstalledFiles(tt.pkg)
			if (err != nil) != tt.wantErr {
				t.Errorf("Apt.ListInstalledFiles() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && len(got) == 0 {
				t.Error("Apt.ListInstalledFiles() returned empty list for valid package")
			}
		})
	}
}
