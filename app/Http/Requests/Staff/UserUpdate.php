<?php

namespace App\Http\Requests\Staff;

class UserUpdate extends CustomerRequest
{
    public function rules()
    {
        return $this->customerRules() + [
            'id' => 'required|integer|min:1',
            'password' => 'nullable|string|min:8|max:128',
            'banned' => 'required|in:0,1',
        ];
    }
}
