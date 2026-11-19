#include <stdio.h>

int main(void) {
    FILE *f = fopen("dados.txt", "r");
    if (!f) {
        printf("Nao foi possivel abrir dados.txt\n");
        return 1;
    }

    int a, b;
    if (fscanf(f, "%d %d", &a, &b) == 2) {
        printf("Soma: %d\n", a + b);
    }

    fclose(f);
    return 0;
}
