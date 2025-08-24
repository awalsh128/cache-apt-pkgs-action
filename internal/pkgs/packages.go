// Package pkgs provides package management functionality using APT.
package pkgs

import (
	"fmt"
	"slices"
	"strings"

	"awalsh128.com/cache-apt-pkgs-action/internal/logging"
	"github.com/bluet/syspkg/manager"
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

func NewPackagesFromSyspkg(pkgs []manager.PackageInfo) Packages {
	items := packages{}
	for _, pkg := range pkgs {
		items = append(items, Package{Name: pkg.Name, Version: pkg.Version})
	}
	return NewPackages(items...)
}

func NewPackages(pkgs ...Package) Packages {
	// Create a new slice to avoid modifying the input
	result := make(packages, len(pkgs))
	copy(result, pkgs)

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

// ParsePackageArgs parses package arguments and returns a new Packages instance
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
