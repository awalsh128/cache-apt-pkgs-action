package main

import (
	"flag"
	"fmt"
	"path/filepath"

	"awalsh128.com/cache-apt-pkgs-action/cmd/cache_apt_pkgs/cmdflags"
	"awalsh128.com/cache-apt-pkgs-action/internal/cache"
	"awalsh128.com/cache-apt-pkgs-action/internal/logging"
	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

func restore(cmd *cmdflags.Cmd, pkgArgs pkgs.Packages) error {
	manifestPath := filepath.Join(cmd.StringFlag("cache-dir"), "manifest.json")
	logging.Info("Reading manifest from %s.", manifestPath)

	manifest, err := cache.Read(manifestPath)
	if err != nil {
		return fmt.Errorf("error reading manifest from %s: %v", manifestPath, err)
	}

	// Extract all installed packages from the manifest
	installedPkgList := make([]pkgs.Package, 0, len(manifest.InstalledPackages))
	for _, manifestPkg := range manifest.InstalledPackages {
		installedPkgList = append(installedPkgList, manifestPkg.Package)
	}
	installedPkgs := pkgs.NewPackages(installedPkgList...)

	// Set GitHub Actions outputs
	cmd.GhioPrinter.SetOutput("package-version-list", pkgArgs)
	cmd.GhioPrinter.SetOutput("all-package-version-list", installedPkgs)

	logging.Info("Completed package restoration.")
	return nil
}

func GetRestoreCmd() *cmdflags.Cmd {
	cmd := &cmdflags.Cmd{
		Name:        "restore",
		Description: "Restore packages from the cache",
		Flags:       flag.NewFlagSet("restore", flag.ExitOnError),
		Run:         restore,
	}
	cmd.Flags.String(
		"cache-dir",
		"",
		"Directory that holds the cached packages, JSON manifest and package lists in text format",
	)
	cmd.Flags.String("restore-root", "/", "Root directory to untar the cached packages to")
	cmd.Flags.Bool("execute-scripts", false, "Execute APT post-install scripts on restore")
	cmd.Examples = []string{
		"--cache-dir ~/cache_dir --restore-root / --execute-scripts true",
		"--cache-dir /tmp/cache_dir --restore-root /",
	}
	cmd.ExamplePackages = cmdflags.ExamplePackages

	return cmd
}
