// Package testing provides precondition checks to ensure invariants in code are met.
package testing

import "fmt"

type FieldValue struct {
	name  string
	value any
}

func isEmpty(v any) bool {
	switch v := v.(type) {
	case *any, chan any, func():
		return v == nil
	case []any:
		return len(v) == 0
	case map[any]any:
		return len(v) == 0
	case byte, int, int8, int16, int32, int64, uintptr:
		return v == 0
	case complex128, complex64:
		return v == 0+0i
	case error:
		return v == nil
	case float32, float64:
		return v == 0.0
	case string:
		return v == ""
	case struct{}:
		return true
	default:
		panic(fmt.Sprintf("unsupported type: %T", v))
	}
}

// RequireNonEmpty returns an error if any of the provided FieldValue instances are empty.
func RequireNonEmpty(args ...FieldValue) error {
	for _, arg := range args {
		if isEmpty(arg.value) {
			return fmt.Errorf("argument %v is empty", arg.name)
		}
	}
	return nil
}
