package common

import (
	"strings"
)

// Checks if an exact string is in an array of strings.
func ArrContainsString(arr []string, element string) bool {
	for _, x := range arr {
		if x == element {
			return true
		}
	}
	return false
}

// A line that has been split into words.
type SplitLine struct {
	Line  string   // The original line.
	Words []string // The split words in the line.
}

// Splits a line into words by the delimiter and max number of delimitation.
func GetSplitLine(line string, delimiter string, numWords int) SplitLine {
	words := strings.SplitN(line, delimiter, numWords)
	trimmedWords := make([]string, len(words))
	for i, word := range words {
		trimmedWords[i] = strings.TrimSpace(word)
	}
	return SplitLine{line, trimmedWords}
}

// Splits a paragraph into lines by newline and then splits each line into words specified by the delimiter and max number of delimitation.
func GetSplitLines(paragraph string, delimiter string, numWords int) []SplitLine {
	lines := []SplitLine{}
	for _, line := range strings.Split(paragraph, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		lines = append(lines, GetSplitLine(trimmed, delimiter, numWords))
	}
	return lines
}
