package main

import (
	"flag"
	"fmt"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"awalsh128.com/cache-apt-pkgs-action/internal/cache"
	"awalsh128.com/cache-apt-pkgs-action/internal/logging"
	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

func install(cmd *Cmd, pkgArgs pkgs.Packages) error {
	apt, err := pkgs.NewApt()
	if err != nil {
		return fmt.Errorf("error initializing APT: %v", err)
	}

	logging.Info("Installing packages:\n%s.", strings.Join(pkgArgs.StringArray(), "\n  "))

	installedPkgs, err := apt.Install(pkgArgs)
	if err != nil {
		return fmt.Errorf("error installing packages: %v", err)
	}

	manifestKey, err := cache.NewKey(
		pkgArgs,
		cmd.StringFlag("version"),
		cmd.StringFlag("global-version"),
		runtime.GOARCH,
	)
	if err != nil {
		return fmt.Errorf("error creating manifest key: %v", err)
	}

	pkgManifests := make([]cache.ManifestPackage, installedPkgs.Len())
	for i := 0; i < installedPkgs.Len(); i++ {
		pkg := installedPkgs.Get(i)
		files, err := apt.ListInstalledFiles(pkg)
		if err != nil {
			return err
		}
		logging.Debug("Package %s installed files:\n%s", pkg.String(), strings.Join(files, "\n"))
		pkgManifests[i] = cache.ManifestPackage{
			Package:   *pkg,
			Filepaths: files,
		}
	}
	manifest := &cache.Manifest{
		CacheKey:          manifestKey,
		LastModified:      time.Now().UTC(),
		InstalledPackages: pkgManifests,
	}

	manifestPath := filepath.Join(cmd.StringFlag("cache-dir"), "manifest.json")
	logging.Info("Writing manifest to %s.", manifestPath)
	if err := cache.Write(manifestPath, manifest); err != nil {
		return fmt.Errorf("error writing manifest to %s: %v", manifestPath, err)
	}
	logging.Info("Wrote manifest to %s.", manifestPath)

	// Set GitHub Actions outputs
	SetPackageVersionList(pkgArgs)
	SetAllPackageVersionList(installedPkgs)

	logging.Info("Completed package installation.")
	return nil
}

func GetInstallCmd() *Cmd {
	cmd := &Cmd{
		Name:        "install",
		Description: "Install packages and saves them to the cache",
		Flags:       flag.NewFlagSet("install", flag.ExitOnError),
		Run:         install,
	}
	cmd.Flags.String(
		"cache-dir",
		"",
		"Directory that holds the cached packages, JSON manifest and package lists in text format",
	)
	cmd.Flags.String(
		"version",
		"",
		"Version of cache to load. Each version will have its own cache. Note, all characters except spaces are allowed.",
	)
	cmd.Flags.String(
		"global-version",
		"",
		"Unique version to force cache invalidation globally across all action callers\n"+
			"Used to fix corrupted caches or bugs from the action itself")
	cmd.Flags.String(
		"manifest-path",
		"",
		"File path that holds the package install manifest in JSON format",
	)
	cmd.Examples = []string{
		"--cache-dir ~/cache_dir --version userver1 --global-version 20250812",
		"--cache-dir /tmp/cache_dir --version what_ever --global-version whatever_too",
	}
	cmd.ExamplePackages = ExamplePackages
	return cmd
}
