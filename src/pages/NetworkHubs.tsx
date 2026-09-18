import { useRouter } from '../router';
export function NetworkHub({ people = false }: { people?: boolean }) {
 const { navigate } = useRouter();
 const items = people ? [['/actors','Актёры','Портфолио и актёрские специализации'],['/models','Модели','Digitals, портфолио и условия работы'],['/professionals','Специалисты','Команда для каждого этапа производства'],['/young-talent','Young Talent','Защищённый доступ для проверенных профессионалов']] : [['/pulse','Пульс','Новости и обсуждения индустрии'],['/events','События','Календарь встреч, фестивалей и мастер-классов'],['/education','Обучение','Киношколы и программы'],['/student-projects','Студенческие проекты','Первые фильмы и профессиональная поддержка'],['/students','Студентам','Образование и подтверждение статуса']];
 return <section className="p-4 sm:p-8 space-y-6"><h1 className="text-3xl font-display">{people?'Люди':'Индустрия'}</h1><div className="grid sm:grid-cols-2 gap-4">{items.map(([path,title,description])=><button key={path} onClick={()=>navigate(path)} className="surface p-6 text-left space-y-2"><h2 className="text-xl">{title}</h2><p className="text-txt-secondary">{description}</p></button>)}</div></section>;
}
