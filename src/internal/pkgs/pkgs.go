package pkgs

import (
	"fmt"
	"strings"

	"github.com/bluet/syspkg"
	"github.com/bluet/syspkg/manager"
)

// Package represents a package with its version information
type Package struct {
	Name    string
	Version string
}

// String returns a string representation of a package in the format "name" or "name=version"
func (p Package) String() string {
	if p.Version != "" {
		return fmt.Sprintf("%s=%s", p.Name, p.Version)
	}
	return p.Name
}

type Packages []Package

func ParsePackageArgs(value []string) *Packages {
	var pkgs Packages
	for _, val := range value {
		parts := strings.SplitN(val, "=", 2)
		if len(parts) == 1 {
			pkgs = append(pkgs, Package{Name: parts[0]})
			continue
		}
		pkgs = append(pkgs, Package{Name: parts[0], Version: parts[1]})
	}
	return &pkgs
}

// String returns a string representation of Packages
func (p *Packages) String() string {
	var parts []string
	for _, arg := range *p {
		parts = append(parts, arg.String())
	}
	return strings.Join(parts, " ")
}

type Apt struct {
	Manager syspkg.PackageManager
}

func New() (*Apt, error) {
	registry, err := syspkg.New(syspkg.IncludeOptions{AptFast: true})
	if err != nil {
		return nil, fmt.Errorf("error initializing SysPkg: %v", err)
	}

	// Get APT package manager (if available)
	aptManager, err := registry.GetPackageManager("apt-fast")
	if err != nil {
		return nil, fmt.Errorf("APT package manager not available: %v", err)
	}

	return &Apt{
		Manager: aptManager,
	}, nil
}

func (a *Apt) ValidatePackage(pkg *Package) (syspkg.PackageInfo, error) {
	packageInfo, err := a.Manager.GetPackageInfo(pkg.String(), &manager.Options{AssumeYes: true})
	if err != nil {
		return syspkg.PackageInfo{}, fmt.Errorf("error getting package info: %v", err)
	}
	return packageInfo, nil
}
