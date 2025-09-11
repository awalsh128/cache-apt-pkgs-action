package pkgs

import (
	"testing"
)

// Test constants - meaningful names without "test" prefix
const (
	package1 = "zlib=1.2.3"
	package2 = "rolldice=1.16-1build3"
	package3 = "apt=2.0.0"
)

func TestPackagesNewPackages_referenceNil_executesFail(t *testing.T) {
	if NewPackages() == nil {
		t.Fatal("NewPackages() returned nil")
	}
}

func TestPackagesNewPackages_containsPackages_executesFail(t *testing.T) {
	if NewPackages().Len() != 0 {
		t.Errorf("NewPackages() returned non-empty Packages, actual length %d", NewPackages().Len())
	}
}

func TestPackagesNewPackagesFromStrings(t *testing.T) {
	tests := []struct {
		name          string
		pkgs          []string
		expectedLen   int
		expectedOrder []string // expected order after sorting
	}{
		{
			name:          "Empty input",
			pkgs:          []string{},
			expectedLen:   0,
			expectedOrder: []string{},
		},
		{
			name:          "Single package",
			pkgs:          []string{package1},
			expectedLen:   1,
			expectedOrder: []string{package1},
		},
		{
			name:        "Multiple packages unsorted",
			pkgs:        []string{package2, package1, package3}, // rolldice, zlib, apt
			expectedLen: 3,
			expectedOrder: []string{
				package3,
				package2,
				package1,
			}, // apt, rolldice, zlib (sorted by name)
		},
		{
			name:          "Duplicate packages",
			pkgs:          []string{package1, package1, package3},
			expectedLen:   2,
			expectedOrder: []string{package3, package1},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewPackagesFromStrings(tt.pkgs...)

			// TestPackages Len()
			if actual := p.Len(); actual != tt.expectedLen {
				t.Errorf("Len() = %v, expected %v", actual, tt.expectedLen)
			}

			// TestPackages Get() and verify order
			for i := 0; i < p.Len(); i++ {
				if i >= len(tt.expectedOrder) {
					t.Errorf(
						"Too many packages in result, extra package at index %d: %s",
						i,
						p.Get(i),
					)
					continue
				}
				if actual := p.Get(i); actual.String() != tt.expectedOrder[i] {
					t.Errorf("Get(%d) = %v, expected %v", i, actual, tt.expectedOrder[i])
				}
			}

			// TestPackages String()
			expectedString := ""
			if len(tt.expectedOrder) > 0 {
				for i, pkg := range tt.expectedOrder {
					if i > 0 {
						expectedString += " " // Use space separator to match implementation
					}
					expectedString += pkg
				}
			}
			if actual := p.String(); actual != expectedString {
				t.Errorf("String() = %v, expected %v", actual, expectedString)
			}

			// TestPackages StringArray()
			actualArray := p.StringArray()
			if len(actualArray) != len(tt.expectedOrder) {
				t.Errorf(
					"StringArray() length = %v, expected %v",
					len(actualArray),
					len(tt.expectedOrder),
				)
			} else {
				for i, expected := range tt.expectedOrder {
					if actualArray[i] != expected {
						t.Errorf("StringArray()[%d] = %v, expected %v", i, actualArray[i], expected)
					}
				}
			}
		})
	}
}
