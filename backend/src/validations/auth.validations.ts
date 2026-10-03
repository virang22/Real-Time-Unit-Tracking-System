
/** Schema to validate user login. */
export const loginSchema = {
    type: 'object',
    properties: {
        email: {
            type: 'string',
            format: 'email',
            minLength: 1
        },
        password: {
            type: 'string',
            minLength: 6
        },
    },
    additionalProperties: false,
};

/** Schema to validate user registration. Similar to update user schema but with required fields. */
export const registerSchema = {
    type: 'object',
    properties: {
        name: {
            type: 'string',
            minLength: 2
        },
        email: {
            type: 'string',
            format: 'email',
            minLength: 1
        },
        mobile: {
            type: 'string',
            minLength: 10,
            maxLength: 20,
            pattern: '^[0-9+\\-() ]+$'
        },
        password: {
            type: 'string',
            minLength: 6
        }
    },
    required: ['name', 'email', 'mobile', 'password'],
    additionalProperties: false,
};

/** Schema to validate forgot password. */
export const forgotPasswordSchema = {
    type: 'object',
    properties: {
        email: {
            type: 'string',
            format: 'email',
        }
    },
    required: ['email'],
    additionalProperties: false,
};