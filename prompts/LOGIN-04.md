Abrí con tu navegador https://nginx-central-anpr.testing.docker.dev-dnd.com/www/login.php y sacá una captura. No inicies sesión y no leas el archivo .env.

Después agregá en tests/anpr/login.spec.ts un test nuevo llamado "LOGIN-04 | El campo Contraseña oculta lo que se escribe", con el mismo estilo de los tests que ya están. El test tiene que escribir "prueba123" en el campo Contraseña y verificar que no se ve el texto (el campo es de tipo password), y que el campo Usuario sí es de tipo texto.

Por último ejecutá el test nuevo junto con los de login correcto, contraseña incorrecta y cerrar sesión que ya existen. Los tests leen solos las credenciales: no hace falta que abras el .env.

npx playwright test --project=anpr -g "LOGIN-01|LOGIN-02|LOGIN-04|LOGOUT-01" --workers=1

Al final mostrame una tabla con ID, caso, qué verifica en palabras simples y resultado, y no hagas commit.
