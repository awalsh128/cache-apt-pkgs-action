package common

import (
	"bytes"
	"os/exec"
	"sort"
	"strings"
)

// ExecCommand executes a command and returns its output
var ExecCommand = func(command string, args ...string) (string, error) {
	cmd := exec.Command(command, args...)
	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stdout
	err := cmd.Run()
	return strings.TrimSpace(stdout.String()), err
}

// SortAndJoin sorts a slice of strings and joins them with the specified separator.
func SortAndJoin(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	sorted := make([]string, len(strs))
	copy(sorted, strs)
	sort.Strings(sorted)
	return strings.Join(sorted, sep)
}

// SplitAndTrim splits a string by the given separator and trims whitespace from each part.
// Empty strings are removed from the result.
func SplitAndTrim(s, sep string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, sep)
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}

// ParseKeyValue parses a string in the format "key=value" and returns the key and value.
// If no separator is found, returns the entire string as the key and an empty value.
func ParseKeyValue(s, sep string) (key, value string) {
	parts := strings.SplitN(s, sep, 2)
	key = strings.TrimSpace(parts[0])
	if len(parts) > 1 {
		value = strings.TrimSpace(parts[1])
	}
	return key, value
}

// ContainsAny returns true if any of the substrings are found in s.
func ContainsAny(s string, substrings ...string) bool {
	for _, sub := range substrings {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

// EqualFold reports whether s and t, interpreted as UTF-8 strings,
// are equal under simple Unicode case-folding, which is a more general
// form of case-insensitivity.
func EqualFold(s, t string) bool {
	return strings.EqualFold(s, t)
}

// TrimPrefixCaseInsensitive removes the provided prefix from s if it exists,
// ignoring case. If s doesn't start with prefix, s is returned unchanged.
func TrimPrefixCaseInsensitive(s, prefix string) string {
	if strings.HasPrefix(strings.ToLower(s), strings.ToLower(prefix)) {
		return s[len(prefix):]
	}
	return s
}

// RemoveEmpty removes empty strings from a slice of strings.
func RemoveEmpty(strs []string) []string {
	result := make([]string, 0, len(strs))
	for _, s := range strs {
		if s != "" {
			result = append(result, s)
		}
	}
	return result
}
