function validate(data, schema) {
    const errors = [];

    // Check the data type
    if (!checkType(data, schema.type)) {
        errors.push(`Expected type "${schema.type}"`);

        return {
            valid: false,
            errors
        };
    }

    // Check allowed values
    if (schema.enum) {
        if (!schema.enum.includes(data)) {
            errors.push(
                `must be one of: ${schema.enum.join(", ")}`
            );
        }
    }

    // Object validation
    if (schema.type === "object") {

        // Check required properties
        if (schema.required) {
            for (const property of schema.required) {

                if (!(property in data)) {
                    errors.push(
                        `Missing required property: "${property}"`
                    );
                }
            }
        }

        // Check for properties that aren't allowed
        if (schema.additionalProperties === false) {

            for (const property in data) {

                if (!schema.properties ||
                    !(property in schema.properties)) {

                    errors.push(
                        `Unknown property: "${property}"`
                    );
                }
            }
        }

        // Validate each property
        if (schema.properties) {

            for (const property in schema.properties) {

                if (property in data) {

                    const propertySchema =
                        schema.properties[property];

                    const result = validate(
                        data[property],
                        propertySchema
                    );

                    if (!result.valid) {

                        for (const error of result.errors) {

                            errors.push(
                                `${property}: ${error}`
                            );
                        }
                    }
                }
            }
        }
    }

    // String validation
    if (schema.type === "string") {

        // Minimum string length
        if (
            schema.minLength !== undefined &&
            data.length < schema.minLength
        ) {
            errors.push(
                `must be at least ${schema.minLength} characters long`
            );
        }

        // Maximum string length
        if (
            schema.maxLength !== undefined &&
            data.length > schema.maxLength
        ) {
            errors.push(
                `must be at most ${schema.maxLength} characters long`
            );
        }

        // Regular expression pattern
        if (schema.pattern) {

            const regex = new RegExp(schema.pattern);

            if (!regex.test(data)) {
                errors.push(
                    "does not match the required pattern"
                );
            }
        }
    }

    // Number validation
    if (
        schema.type === "number" ||
        schema.type === "integer"
    ) {

        // Minimum
        if (
            schema.minimum !== undefined &&
            data < schema.minimum
        ) {
            errors.push(
                `must be at least ${schema.minimum}`
            );
        }

        // Maximum
        if (
            schema.maximum !== undefined &&
            data > schema.maximum
        ) {
            errors.push(
                `must be at most ${schema.maximum}`
            );
        }
    }

    // Array validation
    if (schema.type === "array") {

        if (schema.items) {

            for (let i = 0; i < data.length; i++) {

                const result = validate(
                    data[i],
                    schema.items
                );

                if (!result.valid) {

                    for (const error of result.errors) {

                        errors.push(
                            `[${i}]: ${error}`
                        );
                    }
                }
            }
        }

        // Minimum number of items
        if (
            schema.minItems !== undefined &&
            data.length < schema.minItems
        ) {
            errors.push(
                `must contain at least ${schema.minItems} items`
            );
        }

        // Maximum number of items
        if (
            schema.maxItems !== undefined &&
            data.length > schema.maxItems
        ) {
            errors.push(
                `must contain at most ${schema.maxItems} items`
            );
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}


function checkType(value, type) {

    switch (type) {

        case "string":
            return typeof value === "string";

        case "number":
            return (
                typeof value === "number" &&
                Number.isFinite(value)
            );

        case "integer":
            return Number.isInteger(value);

        case "boolean":
            return typeof value === "boolean";

        case "object":
            return (
                typeof value === "object" &&
                value !== null &&
                !Array.isArray(value)
            );

        case "array":
            return Array.isArray(value);

        case "null":
            return value === null;

        default:
            return false;
    }
}

export { validate };