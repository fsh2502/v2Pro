<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;

abstract class CustomerRequest extends FormRequest
{
    protected function customerRules()
    {
        return [
            'email' => 'required|email:strict|max:64',
            'staff_plan_id' => 'sometimes|nullable|integer|min:1',
            'remarks' => 'nullable|string|max:2000',
            // Bytes must be whole, nonnegative and exactly representable in JavaScript.
            'transfer_enable' => 'sometimes|required|integer|min:0|max:9007199254740991',
            'u' => 'sometimes|required|integer|min:0|max:9007199254740991',
            'd' => 'sometimes|required|integer|min:0|max:9007199254740991',
            'expired_at' => 'nullable|integer|min:0',
            'speed_limit' => 'nullable|integer|min:0|max:2147483647',
        ];
    }

    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            foreach (array_diff(array_keys($this->except(['user', 'auth_data'])), array_keys($this->rules())) as $field) {
                $validator->errors()->add($field, 'Staff không được đặt hoặc thay đổi trường này.');
            }
        });
    }
}
