import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { LoreBook } from "@/lib/types";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#efe2c8",
    color: "#2f2419",
    padding: 42,
    fontFamily: "Times-Roman",
    fontSize: 11,
    lineHeight: 1.55,
  },
  coverPage: {
    backgroundColor: "#efe2c8",
    color: "#2a1a0c",
    padding: 48,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#8a6231",
  },
  coverBorder: {
    borderWidth: 1,
    borderColor: "#b89452",
    padding: 36,
    width: "100%",
    alignItems: "center",
  },
  coverEyebrow: {
    fontSize: 9,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: "#6b4a24",
    marginBottom: 18,
  },
  coverTitle: {
    fontSize: 28,
    textAlign: "center",
    marginBottom: 10,
    color: "#24170b",
  },
  coverSubtitle: {
    fontSize: 13,
    textAlign: "center",
    color: "#5a4024",
    marginBottom: 18,
  },
  coverMeta: {
    fontSize: 10,
    textAlign: "center",
    color: "#6b4a24",
    marginTop: 8,
  },
  storyPage: {
    backgroundColor: "#f5ead2",
    padding: 34,
    borderWidth: 1,
    borderColor: "#c9b48a",
  },
  image: {
    width: "100%",
    height: 260,
    objectFit: "cover",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#b89452",
  },
  chapter: {
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#6b4a24",
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    marginBottom: 10,
    color: "#2a1a0c",
  },
  body: {
    fontSize: 11,
    lineHeight: 1.65,
    color: "#2f2419",
    marginBottom: 12,
  },
  footer: {
    marginTop: "auto",
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#8a6a42",
    textAlign: "right",
  },
});

function BookPdfDocument({ book }: { book: LoreBook }) {
  return (
    <Document title={book.title} author={book.characterBible.name}>
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverBorder}>
          <Text style={styles.coverEyebrow}>Personal chronicle</Text>
          <Text style={styles.coverTitle}>{book.title}</Text>
          <Text style={styles.coverSubtitle}>{book.subtitle}</Text>
          <Text style={styles.coverMeta}>{book.characterBible.name}</Text>
          <Text style={styles.coverMeta}>{book.characterBible.legendaryTitle}</Text>
          <Text style={styles.coverMeta}>{book.mainRegion}</Text>
        </View>
      </Page>

      {book.pages.map((page) => (
        <Page key={page.pageNumber} size="A4" style={styles.storyPage} wrap>
          {page.imageUrl ? <Image src={page.imageUrl} style={styles.image} /> : null}
          <Text style={styles.chapter}>
            Chapter {page.pageNumber} · {page.chapter}
          </Text>
          <Text style={styles.title}>{page.title}</Text>
          <Text style={styles.body}>{page.text}</Text>
          <Text style={styles.footer}>Page {page.pageNumber}</Text>
        </Page>
      ))}
    </Document>
  );
}

export async function generateBookPdf(book: LoreBook): Promise<Buffer> {
  const buffer = await renderToBuffer(<BookPdfDocument book={book} />);
  return Buffer.from(buffer);
}
