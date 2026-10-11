<?php

namespace App\Http\Requests\Passport;

use Illuminate\Foundation\Http\FormRequest;

class AuthLogin extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        return [
            // Login identifies an existing account; it does not validate a delivery address.
            // Keep legacy identifiers such as 1234@1 compatible with password verification.
            'email' => 'required|string|max:255',
            'password' => 'required|min:8'
        ];
    }

    public function messages()
    {
        return [
            'email.required' => __('Email can not be empty'),
            'password.required' => __('Password can not be empty'),
            'password.min' => __('Password must be greater than 8 digits')
        ];
    }
}
