package main

import (
	"flag"
	"fmt"
	"os"
	"testing"

	"awalsh128.com/cache-apt-pkgs-action/src/internal/pkgs"
	"github.com/stretchr/testify/assert"
)

const (
	// Packages.Name values
	pkgNameNginx    = "nginx"
	pkgNameRedis    = "redis"
	pkgNamePostgres = "postgresql"

	// Packages.Version values
	pkgVersionNginx    = "1.18.0"
	pkgVersionPostgres = "13.2"

	// Cmd field values
	cmdName        = "test"
	cmdDescription = "test command"

	// File path values
	flagCacheDir   = "/path/to/cache"
	binaryFullPath = "/usr/local/bin/myapp"
	binaryRelPath  = "./bin/myapp"
	binaryBaseName = "myapp"
)

// PkgArg tests

func TestPackagesEmpty(t *testing.T) {
	assert := assert.New(t)
	pkgArgs := pkgs.Packages{}
	assert.Empty(pkgArgs.String(), "empty Packages should return empty string")
}

func TestPackagesSingleWithoutVersion(t *testing.T) {
	assert := assert.New(t)
	pkgArgs := pkgs.Packages{pkgs.Package{Name: pkgNameNginx}}
	assert.Equal(pkgNameNginx, pkgArgs.String(), "Packages with single package without version")
}

func TestPackagesSingleWithVersion(t *testing.T) {
	assert := assert.New(t)
	pkgArgs := pkgs.Packages{pkgs.Package{Name: pkgNameNginx, Version: pkgVersionNginx}}
	expected := pkgNameNginx + "=" + pkgVersionNginx
	assert.Equal(expected, pkgArgs.String(), "Packages with single package with version")
}

func TestPackagesMultiple(t *testing.T) {
	assert := assert.New(t)
	pkgArgs := pkgs.Packages{
		pkgs.Package{Name: pkgNameNginx, Version: pkgVersionNginx},
		pkgs.Package{Name: pkgNameRedis},
		pkgs.Package{Name: pkgNamePostgres, Version: pkgVersionPostgres},
	}
	expected := pkgNameNginx + "=" + pkgVersionNginx + " " + pkgNameRedis + " " + pkgNamePostgres + "=" + pkgVersionPostgres
	assert.Equal(expected, pkgArgs.String(), "Packages with multiple packages")
}

// Cmd tests

func TestCmdName(t *testing.T) {
	assert := assert.New(t)
	cmd := &Cmd{Name: cmdName}
	assert.Equal(cmdName, cmd.Name, "Cmd.Name should match set value")
}

func TestGetFlagCount(t *testing.T) {
	assert := assert.New(t)

	// Test with no flags
	cmd := &Cmd{
		Name:  cmdName,
		Flags: flag.NewFlagSet(cmdName, flag.ExitOnError),
	}
	assert.Equal(0, cmd.getFlagCount(), "Flag count should be 0 for empty FlagSet")

	// Test with one flag
	cmd.Flags.String("test1", "", "test flag 1")
	assert.Equal(1, cmd.getFlagCount(), "Flag count should be 1 after adding one flag")

	// Test with multiple flags
	cmd.Flags.String("test2", "", "test flag 2")
	cmd.Flags.Bool("test3", false, "test flag 3")
	assert.Equal(3, cmd.getFlagCount(), "Flag count should match number of added flags")

	// Test with help flag (which is automatically added)
	assert.Equal(4, cmd.getFlagCount(), "Flag count should include help flag")
}

func TestCmdDescription(t *testing.T) {
	assert := assert.New(t)
	cmd := &Cmd{Description: cmdDescription}
	assert.Equal(cmdDescription, cmd.Description, "Cmd.Description should match set value")
}

func TestCmdExamples(t *testing.T) {
	assert := assert.New(t)
	examples := []string{"--cache-dir " + flagCacheDir}
	cmd := &Cmd{Examples: examples}
	assert.Equal(examples, cmd.Examples, "Cmd.Examples should match set value")
}

func TestCmdExamplePackages(t *testing.T) {
	assert := assert.New(t)
	examplePkgs := &pkgs.Packages{
		pkgs.Package{Name: pkgNameNginx},
		pkgs.Package{Name: pkgNameRedis},
	}
	cmd := &Cmd{ExamplePackages: examplePkgs}
	assert.Equal(examplePkgs, cmd.ExamplePackages, "Cmd.ExamplePackages should match set value")
}

func TestCmdRun(t *testing.T) {
	assert := assert.New(t)
	runCalled := false
	cmd := &Cmd{
		Run: func(cmd *Cmd, pkgArgs *pkgs.Packages) error {
			runCalled = true
			return nil
		},
	}
	err := cmd.Run(cmd, nil)
	assert.True(runCalled, "Cmd.Run should be called")
	assert.NoError(err, "Cmd.Run should not return error")

	// Test error case
	cmd = &Cmd{
		Run: func(cmd *Cmd, pkgArgs *pkgs.Packages) error {
			return fmt.Errorf("test error")
		},
	}
	err = cmd.Run(cmd, nil)
	assert.Error(err, "Cmd.Run should return error")
	assert.Contains(err.Error(), "test error", "Error message should match expected")
}

// Cmds tests

func TestCmdsAdd(t *testing.T) {
	assert := assert.New(t)
	cmds := make(Cmds)
	cmd := &Cmd{Name: cmdName}
	err := cmds.Add(cmd)
	assert.NoError(err, "Add should not return error for new command")

	_, exists := cmds[cmdName]
	assert.True(exists, "command should be added to Cmds map")

	// Test duplicate add
	err = cmds.Add(cmd)
	assert.Error(err, "Add should return error for duplicate command")
	assert.Contains(err.Error(), "already exists", "Error should mention duplicate")
}

func TestCmdsGetExisting(t *testing.T) {
	assert := assert.New(t)
	cmds := make(Cmds)
	cmd := &Cmd{Name: cmdName}
	cmds[cmdName] = cmd

	got, ok := cmds.Get(cmdName)
	assert.True(ok, "Get should return true for existing command")
	assert.Equal(cmd, got, "Get should return correct command")
}

func TestCmdsGetNonExistent(t *testing.T) {
	assert := assert.New(t)
	cmds := make(Cmds)
	_, ok := cmds.Get("nonexistent")
	assert.False(ok, "Get should return false for non-existent command")
}

// Binary name tests

func TestBinaryNameSimple(t *testing.T) {
	origArgs := os.Args
	defer func() { os.Args = origArgs }()

	os.Args = []string{binaryBaseName}
	if got := binaryName; got != binaryBaseName {
		t.Errorf("binaryName = %q, want %q", got, binaryBaseName)
	}
}

func TestBinaryNameWithPath(t *testing.T) {
	origArgs := os.Args
	defer func() { os.Args = origArgs }()

	os.Args = []string{binaryFullPath}
	if got := binaryName; got != binaryBaseName {
		t.Errorf("binaryName = %q, want %q", got, binaryBaseName)
	}
}

func TestBinaryNameWithRelativePath(t *testing.T) {
	origArgs := os.Args
	defer func() { os.Args = origArgs }()

	os.Args = []string{binaryRelPath}
	if got := binaryName; got != binaryBaseName {
		t.Errorf("binaryName = %q, want %q", got, binaryBaseName)
	}
} // Mock for os.Exit to prevent tests from actually exiting
