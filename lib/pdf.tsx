import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { getImageHeightForPage, preparePdfStoryPages, type PdfGenerationContext, type PdfStoryPage } from "@/lib/pdfBookPages";
import type { LoreBook } from "@/lib/types";

const PAGE_PADDING = 30;
const FRAME_PADDING = 20;

const palette = {
  parchment: "#f3e7cf",
  pageSurface: "#faf4e6",
  frameBorder: "#c4a574",
  imageBorder: "#b89462",
  chapter: "#7a5c36",
  title: "#26180c",
  body: "#352820",
  footer: "#9a7d58",
  placeholder: "#b39a72",
  rule: "#d2bc94",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: palette.parchment,
    padding: PAGE_PADDING,
    fontFamily: "Times-Roman",
    color: palette.body,
  },
  frame: {
    flex: 1,
    position: "relative",
    borderWidth: 1,
    borderColor: palette.frameBorder,
    backgroundColor: palette.pageSurface,
    padding: FRAME_PADDING,
    paddingBottom: 36,
    flexDirection: "column",
  },
  imageFrame: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
    paddingBottom: 2,
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderColor: palette.imageBorder,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  placeholderLabel: {
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: palette.placeholder,
    textAlign: "center",
  },
  textBlock: {
    width: "100%",
    flexDirection: "column",
  },
  chapter: {
    fontSize: 8.5,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: palette.chapter,
    marginBottom: 4,
  },
  title: {
    fontFamily: "Times-Bold",
    fontSize: 24,
    lineHeight: 1.15,
    color: palette.title,
    marginTop: 4,
    marginBottom: 10,
  },
  rule: {
    height: 1,
    backgroundColor: palette.rule,
    marginBottom: 10,
    width: "22%",
  },
  body: {
    fontSize: 11.5,
    lineHeight: 1.5,
    color: palette.body,
    textAlign: "justify",
  },
  footer: {
    position: "absolute",
    bottom: 18,
    right: 24,
    fontSize: 8,
    letterSpacing: 2,
    color: palette.footer,
    textTransform: "uppercase",
  },
});

function StoryPdfPage({ page }: { page: PdfStoryPage }) {
  const imageHeight = getImageHeightForPage(page.text.length);

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.frame}>
        <View style={[styles.imageFrame, { height: imageHeight }]}>
          {page.imageSrc ? (
            <Image src={page.imageSrc} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderLabel}>Illustration reserved</Text>
            </View>
          )}
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.chapter}>Chapter {page.pageNumber}</Text>
          <Text style={styles.title}>{page.title}</Text>
          <View style={styles.rule} />
          <Text style={styles.body}>{page.text}</Text>
        </View>

        <Text style={styles.footer}>Page {page.pageNumber}</Text>
      </View>
    </Page>
  );
}

function BookPdfDocument({
  storyPages,
  bookTitle,
  characterName,
}: {
  storyPages: PdfStoryPage[];
  bookTitle: string;
  characterName: string;
}) {
  return (
    <Document title={bookTitle} author={characterName}>
      {storyPages.map((page) => (
        <StoryPdfPage key={page.pageNumber} page={page} />
      ))}
    </Document>
  );
}

export async function generateBookPdf(book: LoreBook, context: PdfGenerationContext = {}): Promise<Buffer> {
  const storyPages = await preparePdfStoryPages(book, context);

  if (storyPages.length !== FULL_BOOK_PAGE_COUNT) {
    console.warn(
      `[PDF_GENERATION] Expected ${FULL_BOOK_PAGE_COUNT} story pages, received ${storyPages.length}.`,
    );
  }

  const buffer = await renderToBuffer(
    <BookPdfDocument
      storyPages={storyPages}
      bookTitle={book.title}
      characterName={book.characterBible.name}
    />,
  );

  return Buffer.from(buffer);
}
