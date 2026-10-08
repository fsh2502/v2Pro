<?php

namespace App\Http\Requests\Staff;

class UserCreate extends CustomerRequest
{
    public function rules()
    {
        return $this->customerRules() + [
            'password' => 'required|string|min:8|max:128',
        ];
    }
}
