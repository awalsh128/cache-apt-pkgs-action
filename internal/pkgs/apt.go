// Package pkgs provides package management functionality using APT.
package pkgs

import (
	"fmt"

	"awalsh128.com/cache-apt-pkgs-action/internal/logging"
	"github.com/awalsh128/syspkg"
	"github.com/awalsh128/syspkg/manager"
)

// Apt wraps the APT package manager functionality.
// It provides a simplified interface for installing and querying packages
// using apt-fast for better performance.
type Apt struct {
	// manager is the underlying package manager implementation
	manager syspkg.PackageManager
}

// NewApt creates a new APT manager instance configured to use apt-fast.
// Returns an error if the APT package manager is not available or cannot be initialized.
func NewApt() (*Apt, error) {
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
		manager: aptManager,
	}, nil
}

// Install installs a set of packages using apt-fast.
// It returns the list of actually installed packages (which may be different from
// the input if some packages were already installed) and any error encountered.
// The installation is performed with --assume-yes and verbose logging enabled.
func (a *Apt) Install(pkgs Packages) (Packages, error) {
	installedPkgs, err := a.manager.Install(
		pkgs.StringArray(),
		&manager.Options{AssumeYes: true, Debug: true, Verbose: true},
	)
	if err != nil {
		return nil, err
	}
	logging.Info("Completed installing packages.")
	logging.Debug("Installed packages: %v.", installedPkgs)
	logging.Info("Skipping packages that are already installed.")

	return NewPackagesFromSyspkg(installedPkgs), nil
}

// ListInstalledFiles returns a list of all files installed by a package.
// This includes configuration files, binaries, libraries, and any other
// files managed by the package system.
func (a *Apt) ListInstalledFiles(pkg *Package) ([]string, error) {
	files, err := a.manager.ListInstalledFiles(pkg.String())
	if err != nil {
		return nil, fmt.Errorf(
			"error listing installed files for package %s: %v",
			pkg.String(),
			err,
		)
	}
	return files, nil
}

func (a *Apt) Validate(pkg *Package) (manager.PackageInfo, error) {
	packageInfo, err := a.manager.GetPackageInfo(pkg.String(), &manager.Options{AssumeYes: true})
	if err != nil {
		return manager.PackageInfo{}, fmt.Errorf("error getting package info: %v", err)
	}
	return packageInfo, nil
}
