package main

import (
	"flag"
	"fmt"
	"path/filepath"
	"runtime"

	"awalsh128.com/cache-apt-pkgs-action/internal/cache"
	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

func createKey(cmd *Cmd, pkgArgs pkgs.Packages) error {
	key := cache.Key{
		Packages:      pkgArgs,
		Version:       cmd.StringFlag("version"),
		GlobalVersion: cmd.StringFlag("global-version"),
		OsArch:        cmd.StringFlag("os-arch"),
	}
	cacheDir := cmd.StringFlag("cache-dir")

	if err := key.Write(
		filepath.Join(cacheDir, "cache_key.txt"),
		filepath.Join(cacheDir, "cache_key.md5")); err != nil {
		return fmt.Errorf("failed to write cache key: %w", err)
	}

	return nil
}

func GetCreateKeyCmd() *Cmd {
	cmd := &Cmd{
		Name:        "createkey",
		Description: "Create a cache key based on the provided options",
		Flags:       flag.NewFlagSet("createkey", flag.ExitOnError),
		Run:         createKey,
	}
	cmd.Flags.String("os-arch", runtime.GOARCH,
		"OS architecture to use in the cache key.\n"+
			"Action may be called from different runners in a different OS. This ensures the right one is fetched")
	cmd.Flags.String("plaintext-path", "", "Path to the plaintext cache key file")
	cmd.Flags.String("ciphertext-path", "", "Path to the hashed cache key file")
	cmd.Flags.String("version", "", "Version of the cache key to force cache invalidation")
	cmd.Flags.String(
		"global-version",
		"",
		"Unique version to force cache invalidation globally across all action callers\n"+
			"Used to fix corrupted caches or bugs from the action itself",
	)
	cmd.Examples = []string{
		"--os-arch amd64 --cache-dir ~/cache_dir --version 1.0.0 --global-version 1",
		"--os-arch x86_64 --cache-dir /tmp/cache_dir --version v2 --global-version 2",
	}
	cmd.ExamplePackages = ExamplePackages
	return cmd
}
