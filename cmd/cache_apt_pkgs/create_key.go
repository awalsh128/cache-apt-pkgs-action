package main

import (
	"fmt"
	"path/filepath"
	"runtime"

	"awalsh128.com/cache-apt-pkgs-action/internal/cache"
	"awalsh128.com/cache-apt-pkgs-action/internal/logging"
	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

func createKey(cmd *Cmd, pkgArgs pkgs.Packages) error {
	key, err := cache.NewKey(
		pkgArgs,
		cmd.StringFlag("version"),
		cmd.StringFlag("global-version"),
		cmd.StringFlag("os-arch"))
	if err != nil {
		return fmt.Errorf("failed to create cache key: %w", err)
	}
	logging.Info("Created cache key: %s (%x)", key.String(), key.Hash())

	cacheDir := cmd.StringFlag("cache-dir")

	plaintextPath := filepath.Join(cacheDir, "cache_key.txt")
	ciphertextPath := filepath.Join(cacheDir, "cache_key.md5")
	if err := key.Write(
		plaintextPath,
		ciphertextPath); err != nil {
		return fmt.Errorf("failed to write cache keys: %w", err)
	}
	logging.Info("Wrote cache key files:\n  %s\n  %s", plaintextPath, ciphertextPath)

	return nil
}

func GetCreateKeyCmd() *Cmd {
	examples := []string{
		"--os-arch amd64 --cache-dir ~/cache_dir --version 1.0.0 --global-version 1",
		"--os-arch x86_64 --cache-dir /tmp/cache_dir --version v2 --global-version 2",
	}
	cmd := NewCmd("createkey", "Create a cache key based on the provided options", examples, createKey)
	cmd.Flags.String("os-arch", runtime.GOARCH,
		"OS architecture to use in the cache key.\n"+
			"Action may be called from different runners in a different OS. This ensures the right one is fetched")
	cmd.Flags.String("cache-dir", "", "Directory that holds the cached packages, JSON manifest and package lists in text format")
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
