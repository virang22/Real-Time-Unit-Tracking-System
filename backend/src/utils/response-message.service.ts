export const responseMessages = {
    // Common Messages
    serverError: 'Internal server error. Please try again later.',
    validationFailed: 'Validation failed. Please check your input.',
    badRequest: 'Invalid request. Please check your input.',
    unauthorized: 'Invalid token.',
    forbidden: 'Access denied. You do not have permission to perform this action.',
    tokenInvalid: 'Invalid or malformed token.',
    notFound: 'Resource not found.',
    conflict: 'Resource already exists.',

    // Module: Authentication
    authentication: {
        invalidEmailOrPassword: 'Invalid email or password.',
        loginFailed: 'Login failed. Please check your email and password.',
        loginSuccess: 'Login successful.',
        registerFailed: 'Registration failed. Please try again later.',
        registerSuccess: 'Registration successful.',
        forgotPasswordFailed: 'Forgot password failed. Please try again later.',
        forgotPasswordSuccess: 'Forgot password successful.',
        resetPasswordFailed: 'Reset password failed. Please try again later.',
        resetPasswordSuccess: 'Reset password successful.',
    },

    // Module: User
    user: {
        retrieved: 'User fetched successfully.',
        retrievedSingle: 'User fetched successfully.',
        notFoundSingle: 'User not found.',
        emailAlreadyRegistered: 'Email is already registered.',
        failedToCreate: 'Failed to create user.',
        updated: 'User updated successfully.',
        failedToUpdate: 'Failed to update user.',
        deleted: 'User deleted successfully.',
        failedToDelete: 'Failed to delete user.',
        userAlreadyDeleted: 'User is already deleted.',
    },
}