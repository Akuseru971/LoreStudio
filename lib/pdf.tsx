import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { preparePdfStoryPages, type PdfGenerationContext, type PdfStoryPage } from "@/lib/pdfBookPages";
import type { LoreBook } from "@/lib/types";

const PAGE_HEIGHT = 842;
const PAGE_PADDING = 22;
const FRAME_PADDING = 16;
const IMAGE_FRAME_HEIGHT = Math.round((PAGE_HEIGHT - PAGE_PADDING * 2 - FRAME_PADDING * 2) * 0.44);

const palette = {
  parchment: "#f3e7cf",
  pageSurface: "#faf4e6",
  frameBorder: "#c4a574",
  imageWell: "#ebe1ce",
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
    borderWidth: 1,
    borderColor: palette.frameBorder,
    backgroundColor: palette.pageSurface,
    padding: FRAME_PADDING,
    flexDirection: "column",
  },
  imageFrame: {
    width: "100%",
    height: IMAGE_FRAME_HEIGHT,
    backgroundColor: palette.imageWell,
    borderWidth: 1,
    borderColor: palette.imageBorder,
    padding: 10,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
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
    paddingHorizontal: 18,
  },
  placeholderLabel: {
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: palette.placeholder,
    textAlign: "center",
  },
  textBlock: {
    flexGrow: 1,
    flexDirection: "column",
  },
  chapter: {
    fontSize: 7.5,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: palette.chapter,
    marginBottom: 4,
  },
  title: {
    fontFamily: "Times-Bold",
    fontSize: 16,
    lineHeight: 1.2,
    color: palette.title,
    marginBottom: 7,
  },
  rule: {
    height: 1,
    backgroundColor: palette.rule,
    marginBottom: 8,
    width: "28%",
  },
  body: {
    fontSize: 10.5,
    lineHeight: 1.58,
    color: palette.body,
    textAlign: "justify",
  },
  footerRow: {
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: palette.rule,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  footer: {
    fontSize: 7,
    letterSpacing: 1.4,
    color: palette.footer,
    textTransform: "uppercase",
  },
});

function StoryPdfPage({ page }: { page: PdfStoryPage }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.frame}>
        <View style={styles.imageFrame}>
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

        <View style={styles.footerRow}>
          <Text style={styles.footer}>Page {page.pageNumber}</Text>
        </View>
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
