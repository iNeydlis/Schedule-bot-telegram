import { Teacher } from '../types';

export class TeachersService {
  private static instance: TeachersService;
  private teachers: Teacher[] = [
    {
      fullName: "Александрова Вера Александровна",
      shortName: "Александрова В.А.",
      disciplines: []
    },
    {
      fullName: "Алексеева Юлия Владимировна",
      shortName: "Алексеева Ю.В.",
      disciplines: []
    },
    {
      fullName: "Алтухова Марина Викторовна",
      shortName: "Алтухова М.В.",
      disciplines: []
    },
    {
      fullName: "Анохина Наталья Михайловна",
      shortName: "Анохина Н.М.",
      disciplines: []
    },
    {
      fullName: "Анциферова Полина",
      shortName: "Анциферова П.",
      disciplines: []
    },
    {
      fullName: "Ахмедова Марина Михайловна",
      shortName: "Ахмедова М.М.",
      disciplines: []
    },
    {
      fullName: "Бакланова Раиса Абдуловна",
      shortName: "Бакланова Р.А.",
      disciplines: []
    },
    {
      fullName: "Баринова Елена Васильевна",
      shortName: "Баринова Е.В.",
      disciplines: []
    },
    {
      fullName: "Батина Екатерина Михайловна",
      shortName: "Батина Е.М.",
      disciplines: []
    },
    {
      fullName: "Белых Станислав Геннадьевич",
      shortName: "Белых С.Г.",
      disciplines: []
    },
    {
      fullName: "Богданов Сергей Григорьевич",
      shortName: "Богданов С.Г.",
      disciplines: []
    },
    {
      fullName: "Богрова Татьяна Александровна",
      shortName: "Богрова Т.А.",
      disciplines: []
    },
    {
      fullName: "Бондарь Алексей Юрьевич",
      shortName: "Бондарь А.Ю.",
      disciplines: []
    },
    {
      fullName: "Борзенко Артем Викторович",
      shortName: "Борзенко А.В.",
      disciplines: []
    },
    {
      fullName: "Будник Оксана Валерьевна",
      shortName: "Будник О.В.",
      disciplines: []
    },
    {
      fullName: "Бушов Денис Геннадьевич",
      shortName: "Бушов Д.Г.",
      disciplines: []
    },
    {
      fullName: "Васильева Ольга Федоровна",
      shortName: "Васильева О.Ф.",
      disciplines: []
    },
    {
      fullName: "Веселова Алена Игоревна",
      shortName: "Веселова А.И.",
      disciplines: []
    },
    {
      fullName: "Викторов Иван Дмитриевич",
      shortName: "Викторов И.Д.",
      disciplines: []
    },
    {
      fullName: "Виноградов Павел Петрович",
      shortName: "Виноградов П.П.",
      disciplines: []
    },
    {
      fullName: "Виноградова Оксана Владимировна",
      shortName: "Виноградова О.В.",
      disciplines: []
    },
    {
      fullName: "Волчок Мария Васильевна",
      shortName: "Волчок М.В.",
      disciplines: []
    },
    {
      fullName: "Воронцов Вадим Валерьевич",
      shortName: "Воронцов В.В.",
      disciplines: []
    },
    {
      fullName: "Гаврилова Надежда Алексеевна",
      shortName: "Гаврилова Н.А.",
      disciplines: []
    },
    {
      fullName: "Ганьшина Ирина Николаевна",
      shortName: "Ганьшина И.Н.",
      disciplines: []
    },
    {
      fullName: "Глотова Марина Юрьевна",
      shortName: "Глотова М.Ю.",
      disciplines: []
    },
    {
      fullName: "Говорова Кристина Олеговна",
      shortName: "Говорова К.О.",
      disciplines: []
    },
    {
      fullName: "Головкин Вадим Викторович",
      shortName: "Головкин В.В.",
      disciplines: []
    },
    {
      fullName: "Головкина Наталия Сергеевна",
      shortName: "Головкина Н.С.",
      disciplines: []
    },
    {
      fullName: "Голощапов Алексей Семенович",
      shortName: "Голощапов А.С.",
      disciplines: []
    },
    {
      fullName: "Голубева Ирина Александровна",
      shortName: "Голубева И.А.",
      disciplines: []
    },
    {
      fullName: "Гончарова Ирина Дмитриевна",
      shortName: "Гончарова И.Д.",
      disciplines: []
    },
    {
      fullName: "Грибкова Мария Юрьевна",
      shortName: "Грибкова М.Ю.",
      disciplines: []
    },
    {
      fullName: "Гусева Екатерина Николаевна",
      shortName: "Гусева Е.Н.",
      disciplines: []
    },
    {
      fullName: "Гуськов Сергей Сергеевич",
      shortName: "Гуськов С.С.",
      disciplines: []
    },
    {
      fullName: "Додунов Дмитрий Васильевич",
      shortName: "Додунов Д.В.",
      disciplines: []
    },
    {
      fullName: "Докучаева Ксения Сергеевна",
      shortName: "Докучаева К.С.",
      disciplines: []
    },
    {
      fullName: "Дорожкин Дмитрий Михайлович",
      shortName: "Дорожкин Д.М.",
      disciplines: []
    },
    {
      fullName: "Доценко Анастасия Викторовна",
      shortName: "Доценко А.В.",
      disciplines: []
    },
    {
      fullName: "Дурова Татьяна Владимировна",
      shortName: "Дурова Т.В.",
      disciplines: []
    },
    {
      fullName: "Живодерова Валентина Викторовна",
      shortName: "Живодерова В.В.",
      disciplines: []
    },
    {
      fullName: "Жмутина Алина Ивановна",
      shortName: "Жмутина А.И.",
      disciplines: []
    },
    {
      fullName: "Зубова Александра Сергеевна",
      shortName: "Зубова А.С.",
      disciplines: []
    },
    {
      fullName: "Зубова Оксана Олеговна",
      shortName: "Зубова О.О.",
      disciplines: []
    },
    {
      fullName: "Казачук Елена Валентиновна",
      shortName: "Казачук Е.В.",
      disciplines: []
    },
    {
      fullName: "Кардава Евгения Юрьева",
      shortName: "Кардава Е.Ю.",
      disciplines: []
    },
    {
      fullName: "Карпенкова Ольга Владимировна",
      shortName: "Карпенкова О.В.",
      disciplines: []
    },
    {
      fullName: "Карпов Дмитрий Андреевич",
      shortName: "Карпов Д.А.",
      disciplines: []
    },
    {
      fullName: "Кирсанова Анастасия Николаевна",
      shortName: "Кирсанова А.Н.",
      disciplines: []
    },
    {
      fullName: "Ковалёва Лилия Леонидовна",
      shortName: "Ковалёва Л.Л.",
      disciplines: []
    },
    {
      fullName: "Ковтун Светлана Павловна",
      shortName: "Ковтун С.П.",
      disciplines: []
    },
    {
      fullName: "Кокуркина Анастасия Леонидовна",
      shortName: "Кокуркина А.Л.",
      disciplines: []
    },
    {
      fullName: "Колчанова Любовь Владимировна",
      shortName: "Колчанова Л.В.",
      disciplines: []
    },
    {
      fullName: "Комиссаров Александр Васильевич",
      shortName: "Комиссаров А.В.",
      disciplines: []
    },
    {
      fullName: "Костюк Екатерина Викторовна",
      shortName: "Костюк Е.В.",
      disciplines: []
    },
    {
      fullName: "Орлова (Котова) Анастасия Викторовна",
      shortName: "Орлова А.В.",
      disciplines: []
    },
    {
      fullName: "Кудрявцева Екатерина Александровна",
      shortName: "Кудрявцева Е.А.",
      disciplines: []
    },
    {
      fullName: "Кузнецов Алексей Анатольевич",
      shortName: "Кузнецов А.А.",
      disciplines: []
    },
    {
      fullName: "Курбанова Татьяна Сергеевна",
      shortName: "Курбанова Т.С.",
      disciplines: []
    },
    {
      fullName: "Курбатова Оксана Борисовна",
      shortName: "Курбатова О.Б.",
      disciplines: []
    },
    {
      fullName: "Курганова Ирина Викторовна",
      shortName: "Курганова И.В.",
      disciplines: []
    },
    {
      fullName: "Куршина Татьяна Васильевна",
      shortName: "Куршина Т.В.",
      disciplines: []
    },
    {
      fullName: "Лисовская Наталия Дмитриевна",
      shortName: "Лисовская Н.Д.",
      disciplines: []
    },
    {
      fullName: "Лямин Максим Сергеевич",
      shortName: "Лямин М.С.",
      disciplines: []
    },
    {
      fullName: "Малахова Анастасия Андреевна",
      shortName: "Малахова А.А.",
      disciplines: []
    },
    {
      fullName: "Малашкина Валерия Геннадьевна",
      shortName: "Малашкина В.Г.",
      disciplines: []
    },
    {
      fullName: "Малинина Мария Владимировна",
      shortName: "Малинина М.В.",
      disciplines: []
    },
    {
      fullName: "Маркосова Светлана Владимировна",
      shortName: "Маркосова С.В.",
      disciplines: []
    },
    {
      fullName: "Машарская Наталья Александровна",
      shortName: "Машарская Н.А.",
      disciplines: []
    },
    {
      fullName: "Милицкова Ирина Алексеевна",
      shortName: "Милицкова И.А.",
      disciplines: []
    },
    {
      fullName: "Миронова Татьяна Евгеньевна",
      shortName: "Миронова Т.Е.",
      disciplines: []
    },
    {
      fullName: "Митрошин Павел Алексеевич",
      shortName: "Митрошин П.А.",
      disciplines: []
    },
    {
      fullName: "Мищенков Николай Афанасьевич",
      shortName: "Мищенков Н.А.",
      disciplines: []
    },
    {
      fullName: "Молодкина Людмила Александровна",
      shortName: "Молодкина Л.А.",
      disciplines: []
    },
    {
      fullName: "Морозова Кира Андреевна",
      shortName: "Морозова К.А.",
      disciplines: []
    },
    {
      fullName: "Мурыгин Дмитрий Олегович",
      shortName: "Мурыгин Д.О.",
      disciplines: []
    },
    {
      fullName: "Наумов Олег Владимирович",
      shortName: "Наумов О.В.",
      disciplines: []
    },
    {
      fullName: "Оболенский Евгений Сергеевич",
      shortName: "Оболенский Е.С.",
      disciplines: []
    },
    {
      fullName: "Оборотова Татьяна Алексеевна",
      shortName: "Оборотова Т.А.",
      disciplines: []
    },
    {
      fullName: "Овсянникова Надежда Александровна",
      shortName: "Овсянникова Н.А.",
      disciplines: []
    },
    {
      fullName: "Орлов Дмитрий Николаевич",
      shortName: "Орлов Д.Н.",
      disciplines: []
    },
    {
      fullName: "Павлов Андрей Борисович",
      shortName: "Павлов А.Б.",
      disciplines: []
    },
    {
      fullName: "Пепеляева Зоя Сергеевна",
      shortName: "Пепеляева З.С.",
      disciplines: []
    },
    {
        fullName: "Першукова Ольга Васильевна",
        shortName: "Першукова О.В.",
        disciplines: []
    },
      {
        fullName: "Первушкина Дарья Андреевна",
        shortName: "Первушкина Д.А.",
        disciplines: []
      },
      {
        fullName: "Пикулин Юрий Юрьевич",
        shortName: "Пикулин Ю.Ю.",
        disciplines: []
      },
      {
        fullName: "Подколзина Анджэлла Ивановна",
        shortName: "Подколзина А.И.",
        disciplines: []
      },
      {
        fullName: "Подхватилина Татьяна Андреевна",
        shortName: "Подхватилина Т.А.",
        disciplines: []
      },
      {
        fullName: "Полунина Екатерина Михайловна",
        shortName: "Полунина Е.М.",
        disciplines: []
      },
      {
        fullName: "Порицкая Галина Владиславовна",
        shortName: "Порицкая Г.В.",
        disciplines: []
      },
      {
        fullName: "Прохорова Екатерина Романовна",
        shortName: "Прохорова Е.Р.",
        disciplines: []
      },
      {
        fullName: "Прохорова Светлана Николаевна",
        shortName: "Прохорова С.Н.",
        disciplines: []
      },
      {
        fullName: "Птицына Александра Андреевна",
        shortName: "Птицына А.А.",
        disciplines: []
      },
      {
        fullName: "Пугинская Татьяна Ивановна",
        shortName: "Пугинская Т.И.",
        disciplines: []
      },
      {
        fullName: "Пылаева Надежда Сергеевна",
        shortName: "Пылаева Н.С.",
        disciplines: []
      },
      {
        fullName: "Решетникова Оксана Леонидовна",
        shortName: "Решетникова О.Л.",
        disciplines: []
      },
      {
        fullName: "Рогова Марина Васильевна",
        shortName: "Рогова М.В.",
        disciplines: []
      },
      {
        fullName: "Родина Татьяна Евгеньевна",
        shortName: "Родина Т.Е.",
        disciplines: []
      },
      {
        fullName: "Родионов Сергей Александрович",
        shortName: "Родионов С.А.",
        disciplines: []
      },
      {
        fullName: "Родионова Анастасия Сергеевна",
        shortName: "Родионова А.С.",
        disciplines: []
      },
      {
        fullName: "Савин Евгений Валерьевич",
        shortName: "Савин Е.В.",
        disciplines: []
      },
      {
        fullName: "Савина Екатерина Владимировна",
        shortName: "Савина Е.В.",
        disciplines: []
      },
      {
        fullName: "Сальникова Мария Алексеевна",
        shortName: "Сальникова М.А.",
        disciplines: []
      },
      {
        fullName: "Светлова Татьяна Валерьевна",
        shortName: "Светлова Т.В.",
        disciplines: []
      },
      {
        fullName: "Сенгилейцев Юрий Евгеньевич",
        shortName: "Сенгилейцев Ю.Е.",
        disciplines: []
      },
      {
        fullName: "Серебрякова Олеся Евгеньевна",
        shortName: "Серебрякова О.Е.",
        disciplines: []
      },
      {
        fullName: "Сидоров Сергей Романович",
        shortName: "Сидоров С.Р.",
        disciplines: []
      },
      {
        fullName: "Сизова Ирина Гаруновна",
        shortName: "Сизова И.Г.",
        disciplines: []
      },
      {
        fullName: "Слезкин Александр Викторович",
        shortName: "Слезкин А.В.",
        disciplines: []
      },
      {
        fullName: "Слепужникова Марина Ивановна",
        shortName: "Слепужникова М.И.",
        disciplines: []
      },
      {
        fullName: "Сорокин Николай Александрович",
        shortName: "Сорокин Н.А.",
        disciplines: []
      },
      {
        fullName: "Ташкинова Марина Александровна",
        shortName: "Ташкинова М.А.",
        disciplines: []
      },
      {
        fullName: "Ташогло Андрей Николаевич",
        shortName: "Ташогло А.Н.",
        disciplines: []
      },
      {
        fullName: "Ташогло Мария Андреевна",
        shortName: "Ташогло М.А.",
        disciplines: []
      },
      {
        fullName: "Терентьев Кирилл Александрович",
        shortName: "Терентьев К.А.",
        disciplines: []
      },
      {
        fullName: "Тишкова Екатерина Михайловна",
        shortName: "Тишкова Е.М.",
        disciplines: []
      },
      {
        fullName: "Ткаченко Вячеслав Яковлевич",
        shortName: "Ткаченко В.Я.",
        disciplines: []
      },
      {
        fullName: "Уланова Елена Валерьевна",
        shortName: "Уланова Е.В.",
        disciplines: []
      },
      {
        fullName: "Ульянов Алексей Анатольевич",
        shortName: "Ульянов А.А.",
        disciplines: []
      },
      {
        fullName: "Фадеева Екатерина Валерьевна",
        shortName: "Фадеева Е.В.",
        disciplines: []
      },
      {
        fullName: "Федосеева Наталья Викторовна",
        shortName: "Федосеева Н.В.",
        disciplines: []
      },
      {
        fullName: "Хорькова Людмила Анатольевна",
        shortName: "Хорькова Л.А.",
        disciplines: []
      },
      {
        fullName: "Хорькова Ольга Александровна",
        shortName: "Хорькова О.А.",
        disciplines: []
      },
      {
        fullName: "Чашкина Ирина Томовна",
        shortName: "Чашкина И.Т.",
        disciplines: []
      },
      {
        fullName: "Чеснова Елена Владимировна",
        shortName: "Чеснова Е.В.",
        disciplines: []
      },
      {
        fullName: "Чикалова Людмила Степановна",
        shortName: "Чикалова Л.С.",
        disciplines: []
      },
      {
        fullName: "Чубан Светлана Николаевна",
        shortName: "Чубан С.Н.",
        disciplines: []
      },
      {
        fullName: "Шевченко Андрей Юрьевич",
        shortName: "Шевченко А.Ю.",
        disciplines: []
      },
      {
        fullName: "Широченко Александра Сергеевна",
        shortName: "Широченко А.С.",
        disciplines: []
      },
      {
        fullName: "Широченко Михаил Эльдарович",
        shortName: "Широченко М.Э.",
        disciplines: []
      },
      {
        fullName: "Шулежко Андрей Александрович",
        shortName: "Шулежко А.А.",
        disciplines: []
      },
      {
        fullName: "Шувалова Ольга Тахировна",
        shortName: "Шувалова О.Т.",
        disciplines: []
      },
      {
        fullName: "Южаков Владимир Андреевич",
        shortName: "Южаков В.А.",
        disciplines: []
      },
      {
        fullName: "Ярцева Анна Владимировна",
        shortName: "Ярцева А.В.",
        disciplines: []
      },
      {
        fullName: "Майготова Анна Борисовна",
        shortName: "Майготова А.Б.",
        disciplines: []
      },
      {
        fullName: "Дворницына Алла Александровна",
        shortName: "Дворницына А.А.",
        disciplines: []
      },
      {
        fullName: "Батин Павел Николаевич",
        shortName: "Батин П.Н.",
        disciplines: []
      }
    ];
  
    private constructor() {}
  
    public static getInstance(): TeachersService {
      if (!TeachersService.instance) {
        TeachersService.instance = new TeachersService();
      }
      return TeachersService.instance;
    }
  
    getFullName(shortName: string): string {
      const teacher = this.findTeacher(shortName);
      return teacher ? teacher.fullName : shortName;
    }
  
    getTeacherInfo(shortName: string): Teacher | null {
      return this.findTeacher(shortName);
    }
  
    getAllTeachers(): Teacher[] {
      return [...this.teachers];
    }
  
    private findTeacher(shortName: string): Teacher | null {
      const teacher = this.teachers.find(t => {
        const normalizedShortName = this.normalizeTeacherName(shortName);
        const normalizedTeacherShortName = this.normalizeTeacherName(t.shortName);
        return normalizedShortName === normalizedTeacherShortName;
      });
      return teacher || null;
    }
  
    private normalizeTeacherName(name: string): string {
      return name.toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    }
  }
  
  export default TeachersService;