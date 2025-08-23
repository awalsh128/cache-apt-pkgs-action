package main

import (
	"crypto/md5"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"awalsh128.com/cache-apt-pkgs-action/src/internal/cache"
	"awalsh128.com/cache-apt-pkgs-action/src/internal/logging"
	"awalsh128.com/cache-apt-pkgs-action/src/internal/pkgs"
)

func createKey(cmd *Cmd, pkgArgs *pkgs.Packages) error {
	key := cache.Key{
		Packages:      *pkgArgs,
		Version:       cmd.Flags.Lookup("version").Value.String(),
		GlobalVersion: cmd.Flags.Lookup("global-version").Value.String(),
		OsArch:        cmd.Flags.Lookup("os-arch").Value.String(),
	}
	cacheDir := cmd.Flags.Lookup("cache-dir").Value.String()

	keyText := key.Hash()
	logging.Info("Created cache key text: %s", keyText)

	keyTextFilepath := filepath.Join(cacheDir, "cache_key.txt")
	logging.Info("Writing cache key text '%s' to '%s'", keyText, keyTextFilepath)
	if err := os.WriteFile(keyTextFilepath, []byte(keyText), 0644); err != nil {
		return fmt.Errorf("failed to write cache key text to %s: %w", keyTextFilepath, err)
	}
	logging.Info("Cache key text written")

	logging.Info("Creating cache key MD5 hash from key text: %s", keyText)
	hash := md5.Sum([]byte(keyText))
	logging.Info("Created cache key with hash: %x", hash)

	keyHashFilepath := filepath.Join(cmd.Flags.Lookup("cache-dir").Value.String(), "cache_key.md5")
	logging.Info("Writing cache key hash '%x' to '%s'", hash, keyHashFilepath)
	if err := os.WriteFile(keyHashFilepath, hash[:], 0644); err != nil {
		return fmt.Errorf("failed to write cache key hash to %s: %w", keyHashFilepath, err)
	}
	logging.Info("Cache key written")

	return nil
}

func installPackages(cmd *Cmd, pkgArgs *pkgs.Packages) error {
	return fmt.Errorf("installPackages not implemented")
}

func restorePackages(cmd *Cmd, pkgArgs *pkgs.Packages) error {
	return fmt.Errorf("restorePackages not implemented")
}

func validatePackages(cmd *Cmd, pkgArgs *pkgs.Packages) error {
	apt, err := pkgs.New()
	if err != nil {
		return fmt.Errorf("error initializing APT: %v", err)
	}

	for _, pkg := range *pkgArgs {
		if _, err := apt.ValidatePackage(&pkg); err != nil {
			logging.Info("invalid: %s - %v", pkg.String(), err)
		} else {
			logging.Info("valid: %s", pkg.String())
		}
	}

	return nil
}

func createCmdFlags(
	createKey func(cmd *Cmd, pkgArgs *pkgs.Packages) error,
	install func(cmd *Cmd, pkgArgs *pkgs.Packages) error,
	restore func(cmd *Cmd, pkgArgs *pkgs.Packages) error) *Cmds {

	examplePackages := &pkgs.Packages{
		pkgs.Package{Name: "rolldice"},
		pkgs.Package{Name: "xdot", Version: "1.1-2"},
		pkgs.Package{Name: "libgtk-3-dev"},
	}

	commands := &Cmds{}
	createKeyCmd := &Cmd{
		Name:        "createkey",
		Description: "Create a cache key based on the provided options",
		Flags:       flag.NewFlagSet("createkey", flag.ExitOnError),
		Run:         createKey,
	}
	createKeyCmd.Flags.String("os-arch", runtime.GOARCH,
		"OS architecture to use in the cache key.\n"+
			"Action may be called from different runners in a different OS. This ensures the right one is fetched")
	createKeyCmd.Flags.String("cache-dir", "", "Directory that holds the cached packages")
	createKeyCmd.Flags.String("version", "", "Version of the cache key to force cache invalidation")
	createKeyCmd.Flags.Int(
		"global-version",
		0,
		"Unique version to force cache invalidation globally across all action callers\n"+
			"Used to fix corrupted caches or bugs from the action itself",
	)
	createKeyCmd.Examples = []string{
		"--os-arch amd64 --cache-dir ~/cache_dir --version 1.0.0 --global-version 1",
		"--os-arch x86_64 --cache-dir /tmp/cache_dir --version v2 --global-version 2",
	}
	createKeyCmd.ExamplePackages = examplePackages
	commands.Add(createKeyCmd)

	installCmd := &Cmd{
		Name:        "install",
		Description: "Install packages and saves them to the cache",
		Flags:       flag.NewFlagSet("install", flag.ExitOnError),
		Run:         install,
	}
	installCmd.Flags.String("cache-dir", "", "Directory that holds the cached packages")
	installCmd.Examples = []string{
		"--cache-dir ~/cache_dir",
		"--cache-dir /tmp/cache_dir",
	}
	installCmd.ExamplePackages = examplePackages
	commands.Add(installCmd)

	restoreCmd := &Cmd{
		Name:        "restore",
		Description: "Restore packages from the cache",
		Flags:       flag.NewFlagSet("restore", flag.ExitOnError),
		Run:         restore,
	}
	restoreCmd.Flags.String("cache-dir", "", "Directory that holds the cached packages")
	restoreCmd.Flags.String("restore-root", "/", "Root directory to untar the cached packages to")
	restoreCmd.Flags.Bool("execute-scripts", false, "Execute APT post-install scripts on restore")
	restoreCmd.Examples = []string{
		"--cache-dir ~/cache_dir --restore-root / --execute-scripts true",
		"--cache-dir /tmp/cache_dir --restore-root /",
	}
	restoreCmd.ExamplePackages = examplePackages
	commands.Add(restoreCmd)

	validatePackagesCmd := &Cmd{
		Name:        "validate",
		Description: "Validate package arguments",
		Flags:       flag.NewFlagSet("validate", flag.ExitOnError),
		Run:         validatePackages,
	}
	validatePackagesCmd.ExamplePackages = examplePackages
	commands.Add(validatePackagesCmd)

	return commands
}

func main() {
	logging.Init("cache_apt_pkgs", true)

	commands := createCmdFlags(createKey, installPackages, restorePackages)
	cmd, pkgArgs := commands.Parse()
	err := cmd.Run(cmd, pkgArgs)
	if err != nil {
		logging.Fatalf("error: %v\n", err)
	}
}
