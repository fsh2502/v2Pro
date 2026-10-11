<?php

namespace App\Rules;

use Illuminate\Contracts\Validation\Rule;

// Account addresses may use a single-label or numeric suffix (for example 1234@1).
class AccountEmail implements Rule
{
    public function passes($attribute, $value)
    {
        return is_string($value) && preg_match('/\A[^@\s\p{C}]+@[^@\s\p{C}]+\z/u', $value) === 1;
    }

    public function message()
    {
        return __('Email format is incorrect');
    }
}
