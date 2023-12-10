package common

import (
	"io"
	"os"
	"path/filepath"
)

func AppendFile(source string, destination string) error {
	createDirectoryIfNotPresent(filepath.Dir(destination))
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(destination, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0644)
	if err != nil {
		return err
	}
	defer out.Close()

	data, err := io.ReadAll(in)
	if err != nil {
		return err
	}

	_, err = out.Write(data)
	if err != nil {
		return err
	}

	return nil
}

func CopyFile(source string, destination string) error {
	createDirectoryIfNotPresent(filepath.Dir(destination))
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(destination)
	if err != nil {
		return err
	}
	defer out.Close()

	data, err := io.ReadAll(in)
	if err != nil {
		return err
	}

	_, err = out.Write(data)
	if err != nil {
		return err
	}

	return nil
}

func MoveFile(source string, destination string) error {
	createDirectoryIfNotPresent(filepath.Dir(destination))
	return os.Rename(source, destination)
}

func ContainsString(arr []string, element string) bool {
	for _, x := range arr {
		if x == element {
			return true
		}
	}
	return false
}

func createDirectoryIfNotPresent(path string) error {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		err := os.MkdirAll(path, 0755)
		if err != nil {
			return err
		}
	}
	return nil
}
