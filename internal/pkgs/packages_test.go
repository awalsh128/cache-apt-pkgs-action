package pkgs

import (
	"testing"
)

func TestNewPackages(t *testing.T) {
	p := NewPackages()
	if p == nil {
		t.Fatal("NewPackages() returned nil")
	}
	if p.Len() != 0 {
		t.Errorf("NewPackages() returned non-empty Packages, got length %d", p.Len())
	}
}

func TestNewPackagesFromStrings(t *testing.T) {
	tests := []struct {
		name        string
		pkgs        []string
		wantLen     int
		wantOrdered []string // expected order after sorting
	}{
		{
			name:        "Empty input",
			pkgs:        []string{},
			wantLen:     0,
			wantOrdered: []string{},
		},
		{
			name:        "Single package",
			pkgs:        []string{"xdot=1.3-1"},
			wantLen:     1,
			wantOrdered: []string{"xdot=1.3-1"},
		},
		{
			name:        "Multiple packages unsorted",
			pkgs:        []string{"zlib=1.2.3", "xdot=1.3-1", "apt=2.0.0"},
			wantLen:     3,
			wantOrdered: []string{"apt=2.0.0", "xdot=1.3-1", "zlib=1.2.3"},
		},
		{
			name:        "Duplicate packages",
			pkgs:        []string{"xdot=1.3-1", "xdot=1.3-1", "apt=2.0.0"},
			wantLen:     2,
			wantOrdered: []string{"apt=2.0.0", "xdot=1.3-1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewPackagesFromStrings(tt.pkgs...)

			// Test Len()
			if got := p.Len(); got != tt.wantLen {
				t.Errorf("Len() = %v, want %v", got, tt.wantLen)
			}

			// Test Get() and verify order
			for i := 0; i < p.Len(); i++ {
				if i >= len(tt.wantOrdered) {
					t.Errorf(
						"Too many packages in result, extra package at index %d: %s",
						i,
						p.Get(i),
					)
					continue
				}
				if got := p.Get(i); got != tt.wantOrdered[i] {
					t.Errorf("Get(%d) = %v, want %v", i, got, tt.wantOrdered[i])
				}
			}

			// Test String()
			wantString := ""
			if len(tt.wantOrdered) > 0 {
				for i, pkg := range tt.wantOrdered {
					if i > 0 {
						wantString += ","
					}
					wantString += pkg
				}
			}
			if got := p.String(); got != wantString {
				t.Errorf("String() = %v, want %v", got, wantString)
			}

			// Test StringArray()
			gotArray := p.StringArray()
			if len(gotArray) != len(tt.wantOrdered) {
				t.Errorf("StringArray() length = %v, want %v", len(gotArray), len(tt.wantOrdered))
			} else {
				for i, want := range tt.wantOrdered {
					if gotArray[i] != want {
						t.Errorf("StringArray()[%d] = %v, want %v", i, gotArray[i], want)
					}
				}
			}
		})
	}
}

func TestPackages_Add(t *testing.T) {
	tests := []struct {
		name        string
		initial     []string
		toAdd       []string
		wantOrdered []string
	}{
		{
			name:        "Add to empty",
			initial:     []string{},
			toAdd:       []string{"xdot=1.3-1"},
			wantOrdered: []string{"xdot=1.3-1"},
		},
		{
			name:        "Add multiple maintaining order",
			initial:     []string{"apt=2.0.0"},
			toAdd:       []string{"zlib=1.2.3", "xdot=1.3-1"},
			wantOrdered: []string{"apt=2.0.0", "xdot=1.3-1", "zlib=1.2.3"},
		},
		{
			name:        "Add duplicate",
			initial:     []string{"xdot=1.3-1"},
			toAdd:       []string{"xdot=1.3-1"},
			wantOrdered: []string{"xdot=1.3-1"},
		},
		{
			name:        "Add same package different version",
			initial:     []string{"xdot=1.3-1"},
			toAdd:       []string{"xdot=1.3-2"},
			wantOrdered: []string{"xdot=1.3-1", "xdot=1.3-2"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewPackagesFromStrings(tt.initial...)

			// Add packages one by one to test Add method
			for _, pkg := range tt.toAdd {
				p.Add(pkg)
			}

			// Verify length
			if got := p.Len(); got != len(tt.wantOrdered) {
				t.Errorf("After Add(), Len() = %v, want %v", got, len(tt.wantOrdered))
			}

			// Verify order using Get
			for i := 0; i < p.Len(); i++ {
				if got := p.Get(i); got != tt.wantOrdered[i] {
					t.Errorf("After Add(), Get(%d) = %v, want %v", i, got, tt.wantOrdered[i])
				}
			}

			// Verify Contains for all added packages
			for _, pkg := range tt.toAdd {
				if !p.Contains(pkg) {
					t.Errorf("After Add(), Contains(%v) = false, want true", pkg)
				}
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
			packages: []string{"apt=2.0.0", "xdot=1.3-1"},
			check:    "xdot=1.3-1",
			want:     true,
		},
		{
			name:     "Package exists (different order)",
			packages: []string{"xdot=1.3-1", "apt=2.0.0"},
			check:    "apt=2.0.0",
			want:     true,
		},
		{
			name:     "Package doesn't exist",
			packages: []string{"xdot=1.3-1", "apt=2.0.0"},
			check:    "nonexistent=1.0",
			want:     false,
		},
		{
			name:     "Similar package different version",
			packages: []string{"xdot=1.3-1"},
			check:    "xdot=1.3-2",
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewPackagesFromStrings(tt.packages...)
			if got := p.Contains(tt.check); got != tt.want {
				t.Errorf("Contains(%v) = %v, want %v", tt.check, got, tt.want)
			}
		})
	}
}
