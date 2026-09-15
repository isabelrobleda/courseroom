-- Renombra el curso importado y quita el prefijo "Módulo 4 · " de sus partes.
update public.courses
   set title = 'Modelo Senda',
       description = 'Modelo Educativo Senda · Colegio Senda · Plataforma Team Meet. Cada parte incluye el material de lectura en PDF, un quiz y una tarea abierta.'
 where title = 'Colegio Senda · Plataforma Team Meet';

update public.modules
   set title = replace(title, 'Módulo 4 · ', '')
 where course_id = (select id from public.courses where title = 'Modelo Senda')
   and title like 'Módulo 4 · %';
