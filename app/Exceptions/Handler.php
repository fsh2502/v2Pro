<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Support\Arr;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;
use Facade\Ignition\Exceptions\ViewException;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class Handler extends ExceptionHandler
{
    /**
     * A list of the exception types that are not reported.
     *
     * @var array
     */
    protected $dontReport = [
        //
    ];

    /**
     * A list of the inputs that are never flashed for validation exceptions.
     *
     * @var array
     */
    protected $dontFlash = [
        'password',
        'password_confirmation',
    ];

    /**
     * Report or log an exception.
     *
     * @param  \Throwable  $exception
     * @return void
     *
     * @throws \Throwable
     */
    public function report(Throwable $exception)
    {
        parent::report($exception);
    }

    /**
     * Render an exception into an HTTP response.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Throwable  $exception
     * @return \Symfony\Component\HttpFoundation\Response
     *
     * @throws \Throwable
     */
    public function render($request, Throwable $exception)
    {
        if ($exception instanceof ViewException) {
            abort(500, "主题渲染失败。如更新主题，参数可能发生变化请重新配置主题后再试。");
        }
        $response = parent::render($request, $exception);
        // Legacy admin controllers return literal Chinese messages. Translate
        // only error fields; never rewrite successful API data or debug traces.
        if ($request->attributes->get('admin_locale') === 'vi-VN'
            && $response instanceof JsonResponse && $response->getStatusCode() >= 400) {
            $data = $response->getData(true);
            if ($exception instanceof ValidationException) {
                $data['message'] = __('The given data was invalid.', [], 'vi-VN');
            } elseif (isset($data['message']) && is_string($data['message'])) {
                $data['message'] = __($data['message'], [], 'vi-VN');
            }
            foreach ($data['errors'] ?? [] as $field => $messages) {
                if (!is_array($messages)) continue;
                $data['errors'][$field] = array_map(function ($message) {
                    return is_string($message) ? __($message, [], 'vi-VN') : $message;
                }, $messages);
            }
            $response->setData($data);
        }
        return $response;
    }


    protected function convertExceptionToArray(Throwable $e)
    {
        return config('app.debug') ? [
            'message' => $e->getMessage(),
            'exception' => get_class($e),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => collect($e->getTrace())->map(function ($trace) {
                return Arr::except($trace, ['args']);
            })->all(),
        ] : [
            'message' => $this->isHttpException($e) ? $e->getMessage() : __("Uh-oh, we've had some problems, we're working on it."),
        ];
    }
}
