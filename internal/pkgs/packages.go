// Package pkgs provides package management functionality using APT.
package pkgs

import (
	"fmt"
	"slices"
	"strings"

	"awalsh128.com/cache-apt-pkgs-action/internal/logging"
	"github.com/awalsh128/syspkg/manager"
)

// packages is an unexported slice type that provides a stable, ordered collection of packages.
// It is unexported to ensure all instances are created through the provided factory functions,
// which maintain the sorting invariant.
type packages []Package

// Packages represents an ordered collection of software packages.
// The interface provides a safe subset of operations that maintain package ordering
// and prevent direct modification of the underlying collection.
type Packages interface {
	// Get returns the package at the specified index.
	// Panics if the index is out of bounds.
	Get(i int) *Package
	// Len returns the number of packages in the collection.
	Len() int
	// String returns a space-separated string of package specifications.
	String() string
	// StringArray returns package specifications as a string array.
	StringArray() []string
}

func (p *packages) Get(i int) *Package {
	if i < 0 || i >= len(*p) {
		logging.Fatalf("index %d out of range 0..%d", i, len(*p))
	}
	return &(*p)[i]
}

func (p *packages) Len() int {
	return len(*p)
}

func (p *packages) StringArray() []string {
	result := make([]string, 0, len(*p))
	for _, pkg := range *p {
		result = append(result, pkg.String())
	}
	return result
}

// String returns a string representation of Packages
func (p *packages) String() string {
	var parts []string
	for _, pkg := range *p {
		parts = append(parts, pkg.String())
	}
	return strings.Join(parts, " ")
}

// NewPackagesFromSyspkg creates a new Packages collection from system package information.
// Converts system-specific package information into the internal Package format,
// preserving name and version information.
//
// Parameters:
//   - pkgs: Array of system package information structures
//
// Returns:
//   - Packages: A new ordered collection of the converted packages
func NewPackagesFromSyspkg(pkgs []manager.PackageInfo) Packages {
	items := packages{}
	for _, pkg := range pkgs {
		items = append(items, Package{Name: pkg.Name, Version: pkg.Version})
	}
	return NewPackages(items...)
}

// NewPackagesFromStrings creates a new Packages collection from package specification strings.
// Each string should be in the format "name" or "name=version".
// Fatally exits if any package string is invalid.
//
// Parameters:
//   - pkgs: Variable number of package specification strings
//
// Returns:
//   - Packages: A new ordered collection of the parsed packages
func NewPackagesFromStrings(pkgs ...string) Packages {
	items := packages{}
	for _, pkgStr := range pkgs {
		pkg, err := NewPackage(pkgStr)
		if err != nil {
			logging.Fatalf("error creating package from string %q: %v", pkgStr, err)
		}
		items = append(items, *pkg)
	}
	return NewPackages(items...)
}

// NewPackages creates a new Packages collection from Package instances.
// Maintains a stable order by sorting packages by name and version.
// Automatically deduplicates packages with identical name and version.
//
// Parameters:
//   - pkgs: Variable number of Package instances
//
// Returns:
//   - Packages: A new ordered collection of unique packages
func NewPackages(pkgs ...Package) Packages {
	// Create a new slice to avoid modifying the input
	result := make(packages, 0, len(pkgs))

	// Add packages, avoiding duplicates
	seenPkgs := make(map[string]bool)
	for _, pkg := range pkgs {
		key := pkg.Name + "=" + pkg.Version
		if !seenPkgs[key] {
			seenPkgs[key] = true
			result = append(result, pkg)
		}
	}

	// Sort packages by name and version
	slices.SortFunc(result, func(lhs, rhs Package) int {
		if lhs.Name != rhs.Name {
			if lhs.Name < rhs.Name {
				return -1
			}
			return 1
		}
		if lhs.Version < rhs.Version {
			return -1
		}
		if lhs.Version > rhs.Version {
			return 1
		}
		return 0
	})

	return &result
}

// ParsePackageArgs parses package arguments into a Packages collection.
// Each argument should be a package specification in the format "name" or "name=version".
// Invalid package specifications will cause an error to be returned.
//
// Parameters:
//   - value: Array of package specification strings to parse
//
// Returns:
//   - Packages: A new ordered collection of the parsed packages
//   - error: Any error encountered while parsing package specifications
func ParsePackageArgs(value []string) (Packages, error) {
	var pkgs packages
	for _, val := range value {
		newPkg, err := NewPackage(val)
		if err != nil {
			return nil, fmt.Errorf("error creating package from arg %q: %v", val, err)
		}
		pkgs = append(pkgs, *newPkg)
	}
	return NewPackages(pkgs...), nil
}
