package pkgs

import (
	"sort"
	"testing"
)

func TestNewPackages(t *testing.T) {
	packages := NewPackages()
	if packages == nil {
		t.Error("NewPackages() returned nil")
	}
	if packages.Len() != 0 {
		t.Errorf("NewPackages() returned non-empty Packages, got length %d", packages.Len())
	}
}

func TestPackages_Add(t *testing.T) {
	tests := []struct {
		name     string
		initial  []string
		add      string
		expected []string
	}{
		{
			name:     "Add to empty",
			initial:  []string{},
			add:      "xdot=1.3-1",
			expected: []string{"xdot=1.3-1"},
		},
		{
			name:     "Add duplicate",
			initial:  []string{"xdot=1.3-1"},
			add:      "xdot=1.3-1",
			expected: []string{"xdot=1.3-1"},
		},
		{
			name:     "Add different version",
			initial:  []string{"xdot=1.3-1"},
			add:      "xdot=1.3-2",
			expected: []string{"xdot=1.3-1", "xdot=1.3-2"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			packages := NewPackages()
			for _, pkg := range tt.initial {
				packages.Add(pkg)
			}
			packages.Add(tt.add)

			// Convert to slice for comparison
			got := make([]string, packages.Len())
			for i := 0; i < packages.Len(); i++ {
				got[i] = packages.Get(i)
			}

			// Sort both slices for comparison
			sort.Strings(got)
			sort.Strings(tt.expected)

			if len(got) != len(tt.expected) {
				t.Errorf("Packages.Add() resulted in wrong length, got %v, want %v", got, tt.expected)
				return
			}

			for i := range got {
				if got[i] != tt.expected[i] {
					t.Errorf("Packages.Add() = %v, want %v", got, tt.expected)
					break
				}
			}
		})
	}
}

func TestPackages_String(t *testing.T) {
	tests := []struct {
		name     string
		packages []string
		want     string
	}{
		{
			name:     "Empty packages",
			packages: []string{},
			want:     "",
		},
		{
			name:     "Single package",
			packages: []string{"xdot=1.3-1"},
			want:     "xdot=1.3-1",
		},
		{
			name:     "Multiple packages",
			packages: []string{"xdot=1.3-1", "rolldice=1.16-1build3"},
			want:     "xdot=1.3-1,rolldice=1.16-1build3",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewPackages()
			for _, pkg := range tt.packages {
				p.Add(pkg)
			}
			if got := p.String(); got != tt.want {
				t.Errorf("Packages.String() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPackages_Contains(t *testing.T) {
	tests := []struct {
		name     string
		packages []string
		check    string
		want     bool
	}{
		{
			name:     "Empty packages",
			packages: []string{},
			check:    "xdot=1.3-1",
			want:     false,
		},
		{
			name:     "Package exists",
			packages: []string{"xdot=1.3-1", "rolldice=1.16-1build3"},
			check:    "xdot=1.3-1",
			want:     true,
		},
		{
			name:     "Package doesn't exist",
			packages: []string{"xdot=1.3-1", "rolldice=1.16-1build3"},
			check:    "nonexistent=1.0",
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewPackages()
			for _, pkg := range tt.packages {
				p.Add(pkg)
			}
			if got := p.Contains(tt.check); got != tt.want {
				t.Errorf("Packages.Contains() = %v, want %v", got, tt.want)
			}
		})
	}
}
