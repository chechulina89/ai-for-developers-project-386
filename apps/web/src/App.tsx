import {
  Badge,
  Button,
  Card,
  MantineProvider,
  SimpleGrid,
  Text,
  Title,
} from '@mantine/core';

const benefits = [
  {
    title: 'Предложения в одном месте',
    description:
      'Каталог поможет знакомиться с предложениями специалистов, не собирая информацию из разных источников.',
  },
  {
    title: 'Понятно о формате заранее',
    description:
      'Описание предложения поможет узнать о содержании и особенностях встречи до начала записи.',
  },
  {
    title: 'Удобный выбор',
    description:
      'Понятный путь поможет сориентироваться в типах встреч и выбрать подходящее предложение.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Ознакомьтесь с типами встреч',
    description:
      'Выберите общий формат: консультацию, обучение или другой тип встречи.',
  },
  {
    number: '02',
    title: 'Изучите предложение специалиста',
    description:
      'Узнайте о содержании и особенностях конкретной услуги до перехода к записи.',
  },
  {
    number: '03',
    title: 'Перейдите к началу записи',
    description:
      'Выберите подходящее предложение и продолжите к планированию встречи.',
  },
];

function Header() {
  return (
    <header className="topbar">
      <a className="identity" href="/" aria-label="Meetly — главная">
        <span className="mark" aria-hidden="true">
          M
        </span>
        <span className="identity-copy">
          <Text fw={700}>Meetly</Text>
          <Text size="xs" c="dimmed">
            Встречи и консультации
          </Text>
        </span>
      </a>
      <Badge color="teal" variant="light">
        В разработке
      </Badge>
    </header>
  );
}

function HomePage() {
  return (
    <main className="home-main">
      <section className="hero" aria-labelledby="page-title">
        <div className="hero-copy">
          <Text className="eyebrow">Сервис встреч и консультаций</Text>
          <Title id="page-title" order={1}>
            Встречи и консультации от специалистов
          </Title>
          <Text className="hero-summary" c="dimmed">
            Meetly создаётся, чтобы помочь разобраться в предложениях
            специалистов, понять формат встречи и перейти к началу записи.
          </Text>
          <Button
            component="a"
            href="/booking"
            className="primary-action"
            size="lg"
          >
            Выбрать встречу
          </Button>
          <Text className="availability-note" size="sm" c="dimmed">
            Каталог и полноценная запись пока в разработке.
          </Text>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="art-orbit art-orbit-outer" />
          <span className="art-orbit art-orbit-inner" />
          <span className="art-core">M</span>
          <span className="art-dot art-dot-one" />
          <span className="art-dot art-dot-two" />
        </div>
      </section>

      <section className="content-section" aria-labelledby="benefits-title">
        <div className="section-heading">
          <Text className="eyebrow">Для клиентов</Text>
          <Title id="benefits-title" order={2}>
            Выбирать будет проще
          </Title>
        </div>
        <SimpleGrid
          className="benefit-grid"
          cols={{ base: 1, sm: 3 }}
          spacing="md"
        >
          {benefits.map((benefit, index) => (
            <Card className="benefit-card" key={benefit.title} padding="lg">
              <Text className="card-index">0{index + 1}</Text>
              <Title order={3}>{benefit.title}</Title>
              <Text c="dimmed">{benefit.description}</Text>
            </Card>
          ))}
        </SimpleGrid>
      </section>

      <section
        className="content-section steps-section"
        aria-labelledby="steps-title"
      >
        <div className="section-heading">
          <Text className="eyebrow">Путь клиента</Text>
          <Title id="steps-title" order={2}>
            Как можно будет выбрать встречу
          </Title>
          <Text className="section-summary" c="dimmed">
            Когда каталог станет доступен, путь от знакомства с предложением до
            начала записи будет понятным.
          </Text>
        </div>
        <ol className="steps-list">
          {steps.map((step) => (
            <li className="step-item" key={step.number}>
              <Text className="step-number">{step.number}</Text>
              <div>
                <Title order={3}>{step.title}</Title>
                <Text c="dimmed">{step.description}</Text>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="provider-note" aria-labelledby="providers-title">
        <div>
          <Text className="eyebrow">Для специалистов</Text>
          <Title id="providers-title" order={2}>
            Встречи от специалистов
          </Title>
        </div>
        <Text c="dimmed">
          Специалисты смогут представить свои услуги и встречи клиентам. Сейчас
          функции для специалистов тоже в разработке.
        </Text>
      </section>
    </main>
  );
}

function BookingPlaceholder() {
  return (
    <main className="placeholder-main">
      <section
        className="placeholder-card"
        aria-labelledby="booking-page-title"
      >
        <Badge color="teal" variant="light">
          Meetly развивается
        </Badge>
        <Title id="booking-page-title" order={1}>
          Каталог встреч и запись
        </Title>
        <Text c="dimmed">
          Каталог встреч и полноценная запись пока в разработке. Сейчас каталог
          недоступен, и завершить бронирование нельзя. Пока можно познакомиться
          с концепцией Meetly. О запуске расскажем позже.
        </Text>
        <Button component="a" href="/" variant="light" size="md">
          Вернуться на главную
        </Button>
      </section>
    </main>
  );
}

export function App() {
  const isBookingPage = window.location.pathname === '/booking';

  return (
    <MantineProvider defaultColorScheme="light">
      <div className="workspace">
        <Header />
        {isBookingPage ? <BookingPlaceholder /> : <HomePage />}
        <footer className="footer">
          <Text size="xs" c="dimmed">
            Meetly — сервис в разработке
          </Text>
        </footer>
      </div>
    </MantineProvider>
  );
}
