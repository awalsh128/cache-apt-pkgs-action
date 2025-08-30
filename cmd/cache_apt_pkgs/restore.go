package main

import (
	"flag"
	"fmt"

	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

func restore(cmd *Cmd, pkgArgs pkgs.Packages) error {
	return fmt.Errorf("restorePackages not implemented")
}

func GetRestoreCmd() *Cmd {
	cmd := &Cmd{
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
	cmd.ExamplePackages = ExamplePackages
	return cmd
}
